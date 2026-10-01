import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthenticationController } from '../../modules/authentication/authentication.controller';
import { AuthenticationService } from '../../modules/authentication/authentication.service';

// DESC control 12 evidence: the real auth controller, with its real guard,
// refuses the request after the configured limit with the bilingual error.
describe('AuthRateLimitGuard on /auth/*', () => {
  const LIMIT = 3;
  let app: INestApplication;
  const login = jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

  beforeEach(async () => {
    login.mockClear();
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'auth', ttl: 60_000, limit: LIMIT }])],
      controllers: [AuthenticationController],
      providers: [{ provide: AuthenticationService, useValue: { login, refresh: jest.fn(), logout: jest.fn(), me: jest.fn() } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const attempt = () =>
    request(app.getHttpServer()).post('/auth/login').send({ email: 'someone@example.com', password: 'not-the-password' });

  it(`allows ${LIMIT} sign-in attempts within the window`, async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      const response = await attempt();
      expect(response.status).toBe(200);
    }
    expect(login).toHaveBeenCalledTimes(LIMIT);
  });

  it('refuses the next attempt with 429 and a bilingual message, without reaching the service', async () => {
    for (let i = 0; i < LIMIT; i += 1) await attempt();
    const refused = await attempt();
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ code: 'RATE_LIMITED' });
    expect(refused.body.messageEn).toEqual(expect.any(String));
    expect(refused.body.messageAr).toEqual(expect.any(String));
    expect(login).toHaveBeenCalledTimes(LIMIT);
  });

  it('counts each endpoint separately, so a refresh still works after sign-in attempts', async () => {
    for (let i = 0; i < LIMIT + 1; i += 1) await attempt();
    const refresh = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: 'x'.repeat(40) });
    expect(refresh.status).not.toBe(429);
  });
});
