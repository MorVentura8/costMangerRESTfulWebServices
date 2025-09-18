// routes/api.js
const express = require('express');
const router = express.Router();

// מודלים מהדאטהבייס (שמות תואמים)
const Cost   = require('../models/costs');
const User   = require('../models/users');
const Log    = require('../models/logs');
const Report = require('../models/report');

// הקטגוריות המותרות (לבדיקת תקינות)
const categories = require('../models/categories');

// בריאות
router.get('/_ping', (req, res) => res.json({ ok: true, route: '/api/_ping' }));

// -----------------------------
// POST /api/add → מוסיף משתמש או הוצאה (auto-detect לפי השדות)
// -----------------------------
router.post('/add', async (req, res) => {
    console.log('POST /api/add body:', req.body);
    try {
        // האם זה בקשה להוספת USER? (כל 4 השדות קיימים)
        const isUserAdd = ['id', 'first_name', 'last_name', 'birthday'].every(k => k in req.body);

        if (isUserAdd) {
            // ---------- הוספת משתמש ----------
            const id         = Number(req.body.id);
            const first_name = String(req.body.first_name ?? '').trim();
            const last_name  = String(req.body.last_name ?? '').trim();

            // נרמול birthday ל"חצות מקומי" אם נשלח בפורמט YYYY-MM-DD
            const bRaw = req.body.birthday;
            let birthday = new Date(bRaw);
            if (typeof bRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bRaw)) {
                const [Y, M, D] = bRaw.split('-').map(Number);
                birthday = new Date(Y, M - 1, D, 0, 0, 0, 0);
            }

            // ולידציות
            if (!Number.isInteger(id) || id <= 0)     return res.status(400).json({ ok:false, error:'invalid id' });
            if (!first_name)                          return res.status(400).json({ ok:false, error:'first_name is required' });
            if (!last_name)                           return res.status(400).json({ ok:false, error:'last_name is required' });
            if (isNaN(birthday.getTime()))            return res.status(400).json({ ok:false, error:'invalid birthday' });

            // ייחודיות id
            const exists = await User.exists({ id });
            if (exists) return res.status(409).json({ ok:false, error:'user already exists' });

            // יצירת המשתמש
            const user = await User.create({ id, first_name, last_name, birthday });

            // לוג
            await Log.create({ event:'USER_ADDED', at:new Date(), userId:id, meta:{ first_name, last_name } });

            // החזרה — רק ארבעת השדות הנדרשים
            return res.status(201).json({
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                birthday: user.birthday
            });
        }

        // ---------- אחרת: הוספת הוצאה ----------
        const description = String(req.body.description ?? '').trim();
        const category    = req.body.category;
        const userid      = Number(req.body.userid);
        const sum         = Number(req.body.sum);

        // תאריך אופציונלי: אסור עבר (תומך גם date וגם createdAt)
        const requestedDateRaw = req.body.createdAt ?? req.body.date;
        let requestedDate;
        if (requestedDateRaw !== undefined) {
            let d = new Date(requestedDateRaw);
            if (typeof requestedDateRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDateRaw)) {
                const [Y, M, D] = requestedDateRaw.split('-').map(Number);
                d = new Date(Y, M - 1, D, 0, 0, 0, 0);
            }
            if (isNaN(d.getTime()))                   return res.status(400).json({ ok:false, error:'invalid date' });
            const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
            if (d < startOfToday)                     return res.status(400).json({ ok:false, error:'date must be today or later' });
            requestedDate = d;
        }

        // ולידציות בסיסיות להוצאה
        if (!description)                            return res.status(400).json({ ok:false, error:'description is required (non-empty string)' });
        if (!categories.includes(category))          return res.status(400).json({ ok:false, error:'invalid category' });
        if (!Number.isInteger(userid))               return res.status(400).json({ ok:false, error:'userid must be an integer' });
        if (!Number.isFinite(sum) || sum < 0)        return res.status(400).json({ ok:false, error:'sum must be a number >= 0' });

        // המשתמש חייב להתקיים
        const userExists = await User.exists({ id: userid });
        if (!userExists)                             return res.status(404).json({ ok:false, error:'user not found' });

        const payload = { description, category, userid, sum };
        if (requestedDate) payload.createdAt = requestedDate;

        const cost = await Cost.create(payload);

        await Log.create({ event:'COST_ADDED', at:new Date(), userId:userid, meta:{ category, sum, description } });

        return res.status(201).json({ ok:true, cost });

    } catch (e) {
        console.error('POST /api/add error:', e);
        return res.status(500).json({ ok:false, error:e.message });
    }
});


// ---------------------------------------------
// GET /api/report?id=<id>&year=<yyyy>&month=<m>
// ---------------------------------------------
router.get('/report', async (req, res) => {
    try {
        const id    = Number(req.query.id);
        const year  = Number(req.query.year);
        const month = Number(req.query.month);

        const bad =
            !Number.isInteger(id)    || id <= 0 ||
            !Number.isInteger(year)  || year < 1970 || year > 2100 ||
            !Number.isInteger(month) || month < 1  || month > 12;

        if (bad) return res.status(400).json({ ok:false, error:'invalid id/year/month' });

        const userExists = await User.exists({ id });
        if (!userExists) return res.status(404).json({ ok:false, error:'user not found' });

        // האם חודש עבר? (לפי השעון המקומי)
        const now  = new Date();
        const nowY = now.getFullYear();
        const nowM = now.getMonth() + 1;
        const isPastMonth = (year < nowY) || (year === nowY && month < nowM);

        // אם חודש עבר – נסה להחזיר מה-cache
        if (isPastMonth) {
            const cached = await Report.findOne({ userid:id, year, month }).lean();
            if (cached) {
                await Log.create({ event:'REPORT_SERVED_FROM_CACHE', at:new Date(), userId:id, meta:{year,month} });
                return res.status(200).json({ userid:id, year, month, costs: cached.costs });
            }
        }

        // גבולות חודש לפי LOCAL TIME (לא UTC)
        const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const end   = new Date(year, month,     1, 0, 0, 0, 0);

        const docs = await Cost
            .find({ userid:id, createdAt: { $gte: start, $lt: end } })
            .select('sum description category createdAt')
            .lean();

        // קיבוץ לפורמט הנדרש
        const buckets = {};
        for (const c of categories) buckets[c] = [];
        for (const d of docs) {
            const day = new Date(d.createdAt).getDate(); // LOCAL day
            buckets[d.category].push({ sum: d.sum, description: d.description, day });
        }
        const costsOut = categories.map(cat => ({ [cat]: buckets[cat] }));

        // אם חודש עבר – שמור cache
        if (isPastMonth) {
            await Report.findOneAndUpdate(
                { userid:id, year, month },
                { $set: { userid:id, year, month, costs: costsOut } },
                { upsert:true, new:true }
            );
            await Log.create({ event:'REPORT_GENERATED', at:new Date(), userId:id, meta:{year,month,count:docs.length} });
        }

        return res.status(200).json({ userid:id, year, month, costs: costsOut });
    } catch (e) {
        console.error('GET /api/report error:', e);
        return res.status(500).json({ ok:false, error: e.message });
    }
});

// ---------------------------------------------
// GET /api/users/:id  -> פרטי משתמש + סכום כל ההוצאות שלו
// ---------------------------------------------
router.get('/users/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        // ולידציה בסיסית
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ ok: false, error: 'invalid id' });
        }

        // שליפת המשתמש
        const user = await User.findOne({ id }).lean();
        if (!user) {
            return res.status(404).json({ ok: false, error: 'user not found' });
        }

        // סכימה של כל ההוצאות של המשתמש
        const agg = await Cost.aggregate([
            { $match: { userid: id } },
            { $group: { _id: null, total: { $sum: '$sum' } } }
        ]);

        const total = agg.length ? agg[0].total : 0;

        // (אופציונלי) לוג
        await Log.create({
            event: 'USER_DETAILS_REQUESTED',
            at: new Date(),
            userId: id,
            meta: { total }
        });

        // תשובה במבנה המדויק שנדרש
        return res.status(200).json({
            first_name: user.first_name,
            last_name:  user.last_name,
            id:         user.id,
            total
        });
    } catch (e) {
        console.error('GET /api/users/:id error:', e);
        return res.status(500).json({ ok: false, error: e.message });
    }
});

// ---------------------------------------------
// GET /api/about  -> חברי צוות (שמות בלבד מה-DB)
// ---------------------------------------------
router.get('/about', async (req, res) => {
    try {
        // עדכן כאן את מזהי המשתמשים של חברי הקבוצה
        const TEAM_IDS = [1]; // לדוגמה: [1, 2, 7]

        // שולפים מה-DB את השדות הדרושים
        const docs = await User.find({ id: { $in: TEAM_IDS } })
            .select('first_name last_name id') // id רק לשימוש פנימי לבדיקה; לא נחזיר אותו
            .sort({ id: 1 })
            .lean();

        if (!docs.length) {
            return res.status(404).json({ ok: false, error: 'team members not found' });
        }

        // מוודאים שאיננו מחזירים שום דבר מעבר לשני השדות הנדרשים
        const members = docs.map(u => ({ first_name: u.first_name, last_name: u.last_name }));

        return res.status(200).json(members);
    } catch (e) {
        console.error('GET /api/about error:', e);
        return res.status(500).json({ ok: false, error: e.message });
    }
});

// ---------------------------------------------
// GET /api/users  -> רשימת כל המשתמשים (שדות: id, first_name, last_name, birthday)
// ---------------------------------------------
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, { _id: 0, id: 1, first_name: 1, last_name: 1, birthday: 1 })
            .sort({ id: 1 })
            .lean();

        // מחזירים תמיד 200 עם מערך (גם אם ריק) – כך נוח לפרונט/בודקים
        return res.status(200).json(users);
    } catch (e) {
        console.error('GET /api/users error:', e);
        return res.status(500).json({ ok: false, error: e.message });
    }
});

// ---------------------------------------------
// GET /api/logs -> רשימת כל הלוגים (event, at, userId, meta בלבד)
// ---------------------------------------------
router.get('/logs', async (req, res) => {
    try {
        const logs = await Log.find(
            {},
            { _id: 0, event: 1, at: 1, userId: 1, meta: 1 } // סינון שדות מיותרים
        )
            .sort({ at: -1 }) // חדש->ישן (לא חובה)
            .lean();

        return res.status(200).json(logs); // גם אם אין—יחזיר []
    } catch (e) {
        console.error('GET /api/logs error:', e);
        return res.status(500).json({ ok: false, error: e.message });
    }
});



module.exports = router;
