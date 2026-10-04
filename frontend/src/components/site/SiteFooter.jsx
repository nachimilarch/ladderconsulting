import { Link } from 'react-router-dom';
import { navigationLinks, companyInfo } from './siteContent';

const footLink = 'text-sm text-gray-300 hover:text-white transition-colors';

export default function SiteFooter() {
    return (
        <footer className="bg-site text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <h3 className="text-xl font-sitehead font-bold mb-4 text-white">{companyInfo.name}</h3>
                        <p className="text-sm text-gray-300 mb-4">{companyInfo.description}</p>
                        <p className="text-sm text-gray-300">{companyInfo.vision}</p>
                    </div>

                    <div>
                        <h4 className="text-lg font-sitehead font-semibold mb-4 text-white">Quick Links</h4>
                        <ul className="space-y-2">
                            {navigationLinks.map((l) => (
                                <li key={l.href}><Link to={l.href} className={footLink}>{l.label}</Link></li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-lg font-sitehead font-semibold mb-4 text-white">Our Services</h4>
                        <ul className="space-y-2">
                            <li><Link to="/training" className={footLink}>Training</Link></li>
                            <li><Link to="/hr-services" className={footLink}>HR Services</Link></li>
                            <li><Link to="/corporate-finance" className={footLink}>Corporate Finance</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-700 text-center">
                    <p className="text-sm text-gray-300">
                        © {new Date().getFullYear()} {companyInfo.name}. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
