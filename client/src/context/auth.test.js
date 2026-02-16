import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import axios from 'axios';
import '@testing-library/jest-dom/extend-expect';
import { AuthProvider, useAuth } from './auth'; // Adjust path accordingly

// Mock Axios
jest.mock('axios', () => ({
    defaults: {
        headers: {
            common: {},
        },
    },
}));

// Mock LocalStorage
Object.defineProperty(window, 'localStorage', {
    value: {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn(),
    },
    writable: true,
});

// A dummy component to consume the hook during testing
const TestComponent = () => {
    const [auth, setAuth] = useAuth();
    return (
        <div>
            <div data-testid="user-name">{auth?.user?.name || 'No User'}</div>
            <div data-testid="auth-token">{auth?.token || 'No Token'}</div>
            <button
                onClick={() => setAuth({ user: { name: 'Jane Doe' }, token: 'new-token' })}
            >
                Update Auth
            </button>
        </div>
    );
};

describe('AuthContext and AuthProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.getItem.mockReturnValue(null);
    });

    it('should show default values when localStorage is empty', () => {
        const { getByTestId } = render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        expect(getByTestId('user-name')).toHaveTextContent('No User');
        expect(getByTestId('auth-token')).toHaveTextContent('No Token');
    });

    it('should hydrate auth state from localStorage on mount', () => {
        const mockData = JSON.stringify({
            user: { name: 'John Doe' },
            token: 'mock-jwt-token'
        });

        localStorage.getItem.mockReturnValue(mockData);

        const { getByTestId } = render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        expect(getByTestId('user-name')).toHaveTextContent('John Doe');
        expect(getByTestId('auth-token')).toHaveTextContent('mock-jwt-token');
    });

    it('should set axios default authorization header based on auth state', async () => {
        const mockData = JSON.stringify({
            user: { name: 'John Doe' },
            token: 'persistent-token'
        });
        localStorage.getItem.mockReturnValue(mockData);

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        // Verify the header was set to axios defaults
        expect(axios.defaults.headers.common['Authorization']).toBe('persistent-token');
    });

    it('should update state and axios headers when setAuth is called', async () => {
        const { getByText, getByTestId } = render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        const updateBtn = getByText('Update Auth');

        fireEvent.click(updateBtn);

        // Verify state update in UI
        expect(getByTestId('user-name')).toHaveTextContent('Jane Doe');
        expect(getByTestId('auth-token')).toHaveTextContent('new-token');

        // Verify axios header was updated following the state change
        expect(axios.defaults.headers.common['Authorization']).toBe('new-token');
    });

    it('should maintain existing state properties when updating user/token', () => {
        // This tests the "...auth" spread logic in your useEffect
        const mockData = JSON.stringify({
            user: { name: 'Initial User' },
            token: 'initial-token'
        });
        localStorage.getItem.mockReturnValue(mockData);

        const { getByTestId } = render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        expect(getByTestId('user-name')).toHaveTextContent('Initial User');
    });
});