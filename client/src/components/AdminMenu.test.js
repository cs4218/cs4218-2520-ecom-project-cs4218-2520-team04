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
            'Orders'
        ];

        links.forEach(linkText => {
            const link = getByText(linkText);
            expect(link).toHaveClass('list-group-item');
            expect(link).toHaveClass('list-group-item-action');
        });
    });

    it('does not render the commented out Users link', () => {
        const { queryByText } = render(
            <MemoryRouter>
                <AdminMenu />
            </MemoryRouter>
        );

        // queryByText returns null if not found, whereas getByText throws an error
        expect(queryByText('Users')).not.toBeInTheDocument();
    });
});