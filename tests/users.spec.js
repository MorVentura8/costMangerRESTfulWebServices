const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');

jest.setTimeout(20000);

beforeAll(async () => {
    // מבטיח שיש משתמש בדיקה id=1
    await request(app).get('/db/test-user').expect(200);
});

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});

describe('Users endpoints', () => {
    test('GET /api/users -> returns array of users', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length) {
            const u = res.body[0];
            expect(u).toEqual(
                expect.objectContaining({
                    id: expect.any(Number),
                    first_name: expect.any(String),
                    last_name: expect.any(String),
                    birthday: expect.any(String),
                })
            );
            // לא מחזירים _id/createdAt/updatedAt
            expect(u).not.toHaveProperty('_id');
            expect(u).not.toHaveProperty('createdAt');
            expect(u).not.toHaveProperty('updatedAt');
        }
    });

    test('GET /api/users/1 -> returns details object', async () => {
        const res = await request(app).get('/api/users/1');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(
            expect.objectContaining({
                id: 1,
                first_name: expect.any(String),
                last_name: expect.any(String),
                total: expect.any(Number),
            })
        );
    });

    test('GET /api/users/abc -> 400 invalid id', async () => {
        const res = await request(app).get('/api/users/abc');
        expect(res.status).toBe(400);
    });

    test('GET /api/users/999999 -> 404 (or 400) not found', async () => {
        const res = await request(app).get('/api/users/999999');
        expect([404, 400]).toContain(res.status);
    });
});
