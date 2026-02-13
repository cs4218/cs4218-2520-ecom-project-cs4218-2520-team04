import { hashPassword, comparePassword } from './authHelper';
import bcrypt from 'bcrypt';

// Mock the bcrypt module
jest.mock('bcrypt');

describe('Password Utilities', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    // --- HASH PASSWORD TESTS ---
    describe('hashPassword', () => {
        it('should return a hashed password when successful', async () => {
            const password = 'plainPassword123';
            const mockHash = 'hashed_result_xyz';

            bcrypt.hash.mockResolvedValue(mockHash);

            const result = await hashPassword(password);

            expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
            expect(result).toBe(mockHash);
        });

        it('should log an error if bcrypt.hash fails', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const error = new Error('Hashing failed');

            bcrypt.hash.mockRejectedValue(error);

            await hashPassword('password');

            expect(consoleSpy).toHaveBeenCalledWith(error);
            consoleSpy.mockRestore();
        });
    });

    // --- COMPARE PASSWORD TESTS ---
    describe('comparePassword', () => {
        it('should return true if passwords match', async () => {
            const password = 'plainPassword123';
            const hash = 'hashed_result_xyz';

            bcrypt.compare.mockResolvedValue(true);

            const result = await comparePassword(password, hash);

            expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
            expect(result).toBe(true);
        });

        it('should return false if passwords do not match', async () => {
            bcrypt.compare.mockResolvedValue(false);

            const result = await comparePassword('wrongPass', 'hash');

            expect(result).toBe(false);
        });
    });
});