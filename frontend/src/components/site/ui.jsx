import { Link } from 'react-router-dom';

const VARIANTS = {
    primary: 'bg-site text-white hover:bg-site-light focus:ring-site',
    secondary: 'bg-sitegray text-white hover:bg-sitegray-dark focus:ring-sitegray',
    outline: 'border-2 border-site text-site hover:bg-site hover:text-white focus:ring-site',
};
const SIZES = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
};

export function Button({ children, to, variant = 'primary', size = 'md', className = '', ...rest }) {
    const classes = `inline-flex items-center justify-center whitespace-nowrap font-sitehead font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
    if (to) return <Link to={to} className={classes}>{children}</Link>;
    return <button type="button" className={classes} {...rest}>{children}</button>;
}

export function Card({ children, to, className = '' }) {
    const classes = `bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6 ${className}`;
    if (to) return <Link to={to} className={classes}>{children}</Link>;
    return <div className={classes}>{children}</div>;
}

export function SectionHeading({ title, subtitle, className = '' }) {
    return (
        <div className={`text-center mb-12 ${className}`}>
            <h2 className="text-3xl md:text-4xl font-sitehead font-bold text-site mb-4">{title}</h2>
            {subtitle && <p className="text-lg text-sitegray-dark max-w-2xl mx-auto">{subtitle}</p>}
        </div>
    );
}

// The blue banner at the top of each inner page.
export function PageHero({ title, subtitle }) {
    return (
        <section className="bg-gradient-to-br from-site to-site-light text-white py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h1 className="text-4xl md:text-5xl font-sitehead font-bold mb-6 text-white">{title}</h1>
                <p className="text-xl text-gray-100 max-w-3xl mx-auto">{subtitle}</p>
            </div>
        </section>
    );
}
