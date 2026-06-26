import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'opex-dashboard-secret';

export type AuthTokenPayload = {
  userId: number;
  role: 'employee' | 'field_team' | 'manager' | 'director' | 'super_admin';
  storeId: number | null;
};

export function signToken(payload: AuthTokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
