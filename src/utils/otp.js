const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generate a secure 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash OTP for secure storage
 */
const hashOTP = async (otp) => {
  return await bcrypt.hash(otp, 10);
};

/**
 * Verify OTP
 */
const verifyOTP = async (otp, hashedOtp) => {
  return await bcrypt.compare(otp, hashedOtp);
};

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP
};
