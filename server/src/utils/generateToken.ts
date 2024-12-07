import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const generateToken = () => {
  const clientId = uuidv4();
  const secret = process.env.JWT_SECRET || 'default-secret';
  
  const token = jwt.sign(
    { 
      clientId,
      type: 'tunnel-client'
    },
    secret,
    { 
      expiresIn: '30d' // Token expires in 30 days
    }
  );

  console.log('Generated Token:', token);
  console.log('Client ID:', clientId);
  return token;
};

// Generate and display a token when this script is run directly
if (require.main === module) {
  generateToken();
}

export default generateToken;
