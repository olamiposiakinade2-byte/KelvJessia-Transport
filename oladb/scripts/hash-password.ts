import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password || password.length < 12) throw new Error('Provide a password of at least 12 characters.');

bcrypt.hash(password, 12).then(hash => console.log(hash));
