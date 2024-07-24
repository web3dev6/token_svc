import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

// JWT payload
interface JWTPayload {
  id: string;
  username: string;
  issued_at: string;
  expires_at: string;
  iss: string;
  exp: number;
  iat: number;
  jti: string;
}

// Augment the FastifyRequest interface to include authorizationPayload
declare module 'fastify' {
  interface FastifyRequest {
    authorizationPayload?: JWTPayload;
  }
}

// Middleware function to verify JWT token and attach payload to request
export const tokenAuthMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const authorizationHeader = request.headers['authorization'];
    if (!authorizationHeader || typeof authorizationHeader !== 'string') {
      throw new Error('Authorization header is missing or invalid');
    }
    const token = authorizationHeader.replace('Bearer ', '');
    // console.log('Received token:', token);
    
    // Verify and decode the JWT token
    const jwtSecret = process.env.JWT_SECRET || "12345678901234567890123456789012";
    const decodedToken = jwt.verify(token, jwtSecret) as JWTPayload;

    // Attach the decoded payload to the request object
    request.authorizationPayload = decodedToken;
  } catch (error) {
    console.error('Error in token authentication middleware:', error);
    reply.status(401).send({ error: 'Unauthorized' });
    throw error;
  }
};
