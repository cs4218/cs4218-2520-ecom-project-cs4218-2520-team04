import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import AdminMenu from './AdminMenu';

describe('AdminMenu Component', () => {

    it('renders admin panel heading', () => {
        const { getByText } = render(
            <MemoryRouter>
                <AdminMenu />
            </MemoryRouter>
        );
        expect(getByText('Admin Panel')).toBeInTheDocument();
    });

    it('renders all navigation links with correct text', () => {
        const { getByText } = render(
            <MemoryRouter>
                <AdminMenu />
            </MemoryRouter>
        );

        expect(getByText('Create Category')).toBeInTheDocument();
        expect(getByText('Create Product')).toBeInTheDocument();
        expect(getByText('Products')).toBeInTheDocument();
        expect(getByText('Orders')).toBeInTheDocument();
        expect(getByText('Users')).toBeInTheDocument();
    });

    it('navigation links have correct "to" attributes', () => {
        const { getByText } = render(
            <MemoryRouter>
                <AdminMenu />
            </MemoryRouter>
        );

        expect(getByText('Create Category').closest('a')).toHaveAttribute(
            'href',
            '/dashboard/admin/create-category'
        );
        expect(getByText('Create Product').closest('a')).toHaveAttribute(
            'href',
            '/dashboard/admin/create-product'
        );
        expect(getByText('Products').closest('a')).toHaveAttribute(
            'href',
            '/dashboard/admin/products'
        );
        expect(getByText('Orders').closest('a')).toHaveAttribute(
            'href',
            '/dashboard/admin/orders'
        );
        expect(getByText('Users').closest('a')).toHaveAttribute(
            'href',
            '/dashboard/admin/users'
        );
    });

    it('should have active bootstrap classes for styling', () => {
        const { getByText } = render(
            <MemoryRouter>
                <AdminMenu />
            </MemoryRouter>
        );

        const links = [
            'Create Category',
            'Create Product',
            'Products',
            'Orders',
            'Users'
        ];

        links.forEach(linkText => {
            const link = getByText(linkText);
            expect(link).toHaveClass('list-group-item');
            expect(link).toHaveClass('list-group-item-action');
        });
    });

    it('renders the Users link', () => {
        const { getByText } = render(
            <MemoryRouter>
                <AdminMenu />
            </MemoryRouter>
        );

        const usersLink = getByText('Users');
        expect(usersLink).toBeInTheDocument();
        expect(usersLink.closest('a')).toHaveAttribute('href', '/dashboard/admin/users');
    });
});
