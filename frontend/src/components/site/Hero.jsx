import { useState, useEffect } from 'react';
import { Button } from './ui';

const SLIDES = [
    { src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1920&h=1080&fit=crop', alt: 'Professional business team meeting' },
    { src: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&h=1080&fit=crop', alt: 'Corporate office workspace' },
    { src: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&h=1080&fit=crop', alt: 'Business growth and success' },
];

const Arrow = ({ side, onClick, label, d }) => (
    <button
        onClick={onClick}
        aria-label={label}
        className={`absolute ${side}-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-site p-2 rounded-full shadow-lg transition-all z-30`}
    >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
        </svg>
    </button>
);

export default function Hero() {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setCurrent((i) => (i + 1) % SLIDES.length), 5000);
        return () => clearInterval(id);
    }, []);

    return (
        <section className="relative w-full h-[600px] md:h-[700px] lg:h-[800px] overflow-hidden bg-site-dark">
            <div className="absolute inset-0">
                {SLIDES.map((s, i) => (
                    <div key={s.src} className={`absolute inset-0 transition-opacity duration-500 ${i === current ? 'opacity-100' : 'opacity-0'}`}>
                        <img
                            src={s.src}
                            alt={s.alt}
                            loading={i === 0 ? 'eager' : 'lazy'}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    </div>
                ))}
            </div>

            <div className="absolute inset-0 bg-black/50 z-10" />

            <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-sitehead font-bold mb-6 text-white drop-shadow-lg">
                        Empowering Your Business Growth
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-100 max-w-3xl mx-auto mb-8 drop-shadow-md">
                        Customized Business Consulting for Small &amp; Medium Businesses
                    </p>
                    <Button to="/contact" variant="outline" size="lg" className="bg-white text-site hover:bg-gray-100 shadow-lg">
                        Get Started
                    </Button>
                </div>
            </div>

            <Arrow side="left" label="Previous image" d="M15 19l-7-7 7-7"
                onClick={() => setCurrent((i) => (i === 0 ? SLIDES.length - 1 : i - 1))} />
            <Arrow side="right" label="Next image" d="M9 5l7 7-7 7"
                onClick={() => setCurrent((i) => (i + 1) % SLIDES.length)} />

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-30">
                {SLIDES.map((s, i) => (
                    <button
                        key={s.src}
                        onClick={() => setCurrent(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        className={`h-3 rounded-full transition-all ${i === current ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/75 w-3'}`}
                    />
                ))}
            </div>
        </section>
    );
}
