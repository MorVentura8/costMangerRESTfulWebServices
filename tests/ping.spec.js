const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

jest.setTimeout(20000);

afterAll(async () => {
    // סגירת חיבור ל-DB כדי ש-Jest יסיים מסודר
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});

describe('GET /api/_ping', () => {
    it('returns 200 and ok:true', async () => {
        const res = await request(app).get('/api/_ping');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ ok: true }));
    });
});
