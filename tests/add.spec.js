const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

jest.setTimeout(20000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});

describe('POST /api/add (user & cost)', () => {
    test('adds a new user (201) or 409 if already exists', async () => {
        const res = await request(app).post('/api/add').send({
            id: 777777,                // מזהה גבוה כדי לא להתנגש
            first_name: 'Test',
            last_name: 'User',
            birthday: '1999-09-09'
        });
        expect([201, 409]).toContain(res.status);
        if (res.status === 201) {
            expect(res.body).toEqual(
                expect.objectContaining({
                    id: 777777,
                    first_name: 'Test',
                    last_name: 'User',
                    birthday: expect.any(String),
                })
            );
        }
    });

    test('rejects invalid birthday (400)', async () => {
        const res = await request(app).post('/api/add').send({
            id: 777778,
            first_name: 'Bad',
            last_name: 'Date',
            birthday: '31-13-2020'
        });
        expect(res.status).toBe(400);
    });

    test('adds a cost (201)', async () => {
        const res = await request(app).post('/api/add').send({
            description: 'Jest test cost',
            category: 'food',
            userid: 1,
            sum: 12.34
            // לא שולחים date כדי להימנע מענייני timezones
        });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('cost');
        expect(res.body.cost).toEqual(
            expect.objectContaining({
                description: 'Jest test cost',
                category: 'food',
                userid: 1,
                sum: 12.34
            })
        );
    });

    test('rejects past date (400)', async () => {
        const res = await request(app).post('/api/add').send({
            description: 'Old receipt',
            category: 'food',
            userid: 1,
            sum: 1,
            date: '2020-01-01'
        });
        expect(res.status).toBe(400);
    });

    test('rejects invalid category (400)', async () => {
        const res = await request(app).post('/api/add').send({
            description: 'Invalid cat',
            category: 'travel',
            userid: 1,
            sum: 50
        });
        expect(res.status).toBe(400);
    });

    test('rejects cost for unknown user (404)', async () => {
        const res = await request(app).post('/api/add').send({
            description: 'Unknown user',
            category: 'food',
            userid: 999999,
            sum: 10
        });
        expect([404, 400]).toContain(res.status); // אצלך זה 404 (טוב), אבל נאפשר גם 400
    });
});
