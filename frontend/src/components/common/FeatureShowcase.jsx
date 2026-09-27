import { Link } from 'react-router-dom';

// A grid of what the portal offers — shown on the dashboard so people discover
// features they might not have found yet. Purely informational; `to` is optional.
export default function FeatureShowcase({ title = 'What LadderStep gives you', items }) {
    return (
        <div>
            <h2 className="section-title">{title}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {items.map((item) => {
                    const Card = item.to ? Link : 'div';
                    return (
                        <Card
                            key={item.title}
                            {...(item.to ? { to: item.to } : {})}
                            className={`card-p ${item.to ? 'hover:shadow-card-hover hover:border-brand-200 transition' : ''}`}
                        >
                            <span className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-base shrink-0 mb-2">
                                {item.icon}
                            </span>
                            <p className="text-sm font-semibold text-gray-900 leading-tight">{item.title}</p>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
