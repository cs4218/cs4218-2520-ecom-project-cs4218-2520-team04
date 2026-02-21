// Mervyn Teo Zi Yan, A0273039A
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import AdminDashboard from './AdminDashboard';
import { useAuth } from '../../context/auth';

jest.mock('../../context/auth', () => ({
    useAuth: jest.fn()
}));


jest.mock('../../components/AdminMenu', () => () => <div data-testid="admin-menu">AdminMenu Mock</div>);
jest.mock('./../../components/Layout', () => ({ children }) => <div data-testid="layout">{children}</div>);

// Written with the aid of Gemini AI
describe('AdminDashboard Component', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the dashboard with admin details from auth state', () => {
        // Mock the auth state with specific admin data
        useAuth.mockReturnValue([{
            user: {
                name: 'Admin User',
                email: 'admin@test.com',
                phone: '1234567890'
            }
        }]);

        const { getByText, getByTestId } = render(<AdminDashboard />);

        // Check if layout and menu are present
        expect(getByTestId('layout')).toBeInTheDocument();
        expect(getByTestId('admin-menu')).toBeInTheDocument();

        // Check if admin info is correctly displayed
        expect(getByText(/Admin Name : Admin User/i)).toBeInTheDocument();
        expect(getByText(/Admin Email : admin@test.com/i)).toBeInTheDocument();
        expect(getByText(/Admin Contact : 1234567890/i)).toBeInTheDocument();
    });

    it('handles null or undefined auth values gracefully', () => {
        // Mock the auth state where user might be missing
        useAuth.mockReturnValue([{}]);

        const { getByText } = render(<AdminDashboard />);

        // Components should render labels even if values are missing (preventing crash)
        expect(getByText(/Admin Name :/i)).toBeInTheDocument();
        expect(getByText(/Admin Email :/i)).toBeInTheDocument();
        expect(getByText(/Admin Contact :/i)).toBeInTheDocument();
    });

    it('applies the correct Bootstrap grid classes for layout', () => {
        useAuth.mockReturnValue([{
            user: { name: 'Test Admin' }
        }]);

        const { container } = render(<AdminDashboard />);

        // Verify structure based on your code: col-md-3 for menu, col-md-9 for content
        const menuCol = container.querySelector('.col-md-3');
        const contentCol = container.querySelector('.col-md-9');

        expect(menuCol).toBeInTheDocument();
        expect(contentCol).toBeInTheDocument();
        expect(container.querySelector('.card')).toHaveClass('w-75', 'p-3');
    });
});