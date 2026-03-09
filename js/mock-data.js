/**
 * MOCK DATA - Fallback data when Firebase collections are empty
 * This file provides sample content for development/demo purposes.
 * In production, all data comes from Firebase (managed via Admin Panel).
 */

const MOCK_DATA = {

    // Hero section config
    heroConfig: {
        notificationText: 'SSC CGL 2026 Exam Starts in:',
        countdownDate: 'March 15, 2026 09:00:00'
    },

    // Exam Categories shown on home page
    examCategories: [
        { name: 'TNPSC', shortCode: 'TN', color: '#059669', bg: 'var(--primary-light)', link: 'exams-hub.html?cat=TNPSC' },
        { name: 'RRB', shortCode: 'RL', color: '#3b82f6', bg: '#eff6ff', link: 'exams-hub.html?cat=RRB' },
        { name: 'SSC', shortCode: 'SS', color: '#059669', bg: '#fef2f2', link: 'exams-hub.html?cat=SSC' },
        { name: 'TNUSRB', shortCode: 'PL', color: '#22c55e', bg: '#f0fdf4', link: 'exams-hub.html?cat=TNUSRB' },
        { name: 'BANK', shortCode: 'BK', color: '#d97706', bg: '#fffbeb', link: 'exams-hub.html?cat=BANK' },
        { name: 'TET / TRB', shortCode: 'ED', color: '#9333ea', bg: '#faf5ff', link: 'exams-hub.html?cat=TET' }
    ],

    // Current Affairs highlights on home page
    currentAffairs: [
        'ISRO launches new Earth Observation Satellite.',
        'New Chief Justice of India appointed for 2026.',
        'Global Economic Forum 2026 highlights.'
    ],

    // Free mock tests shown on home page
    freeMockTests: [
        {
            title: 'Group 4 General Tamil Mock',
            category: 'TNPSC',
            questions: 10,
            duration: 90,
            shortCode: 'TN',
            color: '#3b82f6',
            bg: '#eff6ff',
            questions_data: [
                { text: 'Which of the following is the first Sangam literature?', options: { A: 'Agattiyam', B: 'Tolkappiyam', C: 'Purananuru', D: 'Ettuthogai' }, correct: 'A' },
                { text: 'Who wrote the epic Manimekalai?', options: { A: 'Ilango Adigal', B: 'Seethalai Sathanar', C: 'Kambar', D: 'Ottakkoothar' }, correct: 'B' },
                { text: 'The concept of "Ainthinai" refers to:', options: { A: 'Five Lands', B: 'Five Elements', C: 'Five Kings', D: 'Five Languages' }, correct: 'A' },
                { text: 'Thirukkural contains how many chapters?', options: { A: '133', B: '1330', C: '100', D: '150' }, correct: 'A' },
                { text: 'Who is known as the "Father of Tamil Prose"?', options: { A: 'Arumuka Navalar', B: 'U.V. Swaminatha Iyer', C: 'Bharathiyar', D: 'Veeramamunivar' }, correct: 'D' }
            ]
        },
        {
            title: 'SSC CGL Tier 1 Full Mock',
            category: 'SSC',
            questions: 10,
            duration: 60,
            shortCode: 'SS',
            color: '#059669',
            bg: 'var(--primary-light)',
            questions_data: [
                { text: 'Who was the first Governor-General of Bengal?', options: { A: 'Robert Clive', B: 'Warren Hastings', C: 'Lord Cornwallis', D: 'Lord Wellesley' }, correct: 'B' },
                { text: 'Which planet is known as the Red Planet?', options: { A: 'Venus', B: 'Mars', C: 'Jupiter', D: 'Saturn' }, correct: 'B' },
                { text: 'What is the sum of angles in a triangle?', options: { A: '90', B: '180', C: '270', D: '360' }, correct: 'B' },
                { text: 'The Fundamental Rights in India are inspired by which country?', options: { A: 'UK', B: 'USA', C: 'Canada', D: 'Ireland' }, correct: 'B' },
                { text: 'What is the unit of power?', options: { A: 'Joule', B: 'Watt', C: 'Newton', D: 'Pascal' }, correct: 'B' }
            ]
        },
        {
            title: 'RRB NTPC CBT 1 Stage',
            category: 'RRB',
            questions: 10,
            duration: 90,
            shortCode: 'RR',
            color: '#16a34a',
            bg: '#f0fdf4',
            questions_data: [
                { text: 'Where is the headquarters of South Eastern Railway?', options: { A: 'Kolkata', B: 'Chennai', C: 'Mumbai', D: 'Delhi' }, correct: 'A' },
                { text: 'What is the full form of IRCTC?', options: { A: 'Indian Railway Catering and Tourism Corporation', B: 'Indian Railway Core Transport Center', C: 'International Railway Catering Tech Center', D: 'Indian Regional Center for Tourism' }, correct: 'A' },
                { text: 'Which is the longest railway platform in India?', options: { A: 'Gorakhpur', B: 'Kollam', C: 'Kharagpur', D: 'Hubballi' }, correct: 'D' },
                { text: 'The first train in India ran between:', options: { A: 'Bombay to Thane', B: 'Howrah to Hooghly', C: 'Madras to Arkonam', D: 'Delhi to Agra' }, correct: 'A' },
                { text: 'What is the chemical symbol for Gold?', options: { A: 'Ag', B: 'Au', C: 'Fe', D: 'Hg' }, correct: 'B' }
            ]
        }
    ],

    // Popular courses on home page
    courses: [
        {
            title: 'TNPSC Group 2 & 2A Master Program',
            tag: 'FULL COURSE',
            description: 'Complete coverage of GS, Aptitude, and Tamil with 50+ Full Mocks.',
            image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=250&fit=crop'
        },
        {
            title: 'SSC CGL 2026 Ultimate Test Pack',
            tag: 'TEST SERIES',
            description: '300+ Sectional & Full Length Tests with AI Performance Analysis.',
            image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=250&fit=crop'
        },
        {
            title: 'Multi-Exam Ultimate All Access Pass',
            tag: 'ALL ACCESS',
            description: 'Crack TNPSC, SSC, and RRB with one single subscription plan.',
            image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=250&fit=crop'
        }
    ],

    // Success stories / testimonials
    testimonials: [
        {
            text: "Gov Learn's mock tests are so close to the real SSC CGL pattern. I cleared my exam in the first attempt!",
            name: 'Anjali Sharma',
            achievement: 'SSC CGL 2025 Rank #42',
            initial: 'A',
            color: 'var(--primary)',
            bg: 'var(--primary-light)',
            borderColor: 'var(--primary)'
        },
        {
            text: "The video lessons on Indian Polity and History made complex topics so easy to understand. Highly recommended!",
            name: 'Ramesh Kumar',
            achievement: 'TNPSC Group 4 Selection',
            initial: 'R',
            color: '#3b82f6',
            bg: '#eff6ff',
            borderColor: '#3b82f6'
        },
        {
            text: "Ultimate plan mentorship helped me stay consistent. The rank predictor was surprisingly accurate.",
            name: 'Rahul Sharma',
            achievement: 'RRB NTPC Qualified',
            initial: 'R',
            color: 'var(--primary)',
            bg: 'var(--primary-light)',
            borderColor: 'var(--primary)'
        }
    ],

    // Live Updates Ticker items
    tickerItems: [
        { badge: 'NEW', text: 'RRB NTPC 2026 Notification Out! Apply before March 30.' },
        { badge: 'ALERT', text: 'TNPSC Group 2 Hall Tickets Released. Download Now.' },
        { badge: 'UPDATE', text: 'SSC CGL Tier 1 Results Declared. Check Cut-off.' },
        { badge: 'OFFER', text: 'Flat 50% Off on Ultimate Plan for first 100 students!' }
    ],

    // Current Affairs PDFs for current-affairs.html
    currentAffairsPDFs: [
        { title: 'Daily CA - February 2026', description: 'Complete daily current affairs compilation for government exams.', category: 'daily', url: '#' },
        { title: 'Weekly Digest - Week 8', description: 'Top 50 questions from this week with detailed explanations.', category: 'weekly', url: '#' },
        { title: 'Monthly Magazine - January 2026', description: 'In-depth analysis of all major events and their exam relevance.', category: 'monthly', url: '#' },
        { title: 'Daily CA - January 2026', description: 'Complete daily current affairs compilation for January.', category: 'daily', url: '#' },
        { title: 'Daily CA - Week 7', description: 'Top 50 questions from week 7 with solutions.', category: 'weekly', url: '#' },
        { title: 'Yearly Roundup 2025', description: 'Complete year-end review of all important events for exams.', category: 'yearly', url: '#' }
    ],

    // Subscription Plans
    plans: [
        {
            id: 'free',
            name: 'Free',
            price: '0',
            period: '/month',
            features: ['Daily Current Affairs', 'Basic Mock Tests', 'Community Access'],
            buttonText: 'Current Plan',
            popular: false
        },
        {
            id: 'pro',
            name: 'Pro Plan',
            price: '1499',
            period: '/life',
            features: ['Full Mock Test Access', '300+ Expert Videos', 'Personalized Analytics'],
            buttonText: 'Get Pro',
            popular: true,
            badge: 'MOST VALUE'
        },
        {
            id: 'ultimate',
            name: 'Ultimate',
            price: '4999',
            period: '/life',
            features: ['1-on-1 Mentorship', 'Printable Resource Kit', 'Interview Prep'],
            buttonText: 'Unlock All',
            popular: false
        }
    ],

    // Study Materials
    materials: [
        { title: 'Tenth Standard Tamil Complete Notes', subject: 'Tamil', category: 'PDF Notes', pdfUrl: '#' },
        { title: 'English Grammar Rules with Examples', subject: 'English', category: 'Handwritten', pdfUrl: '#' },
        { title: 'Quantitative Aptitude Formula Book', subject: 'Maths', category: 'PDF Notes', pdfUrl: '#' },
        { title: 'Logical Reasoning Practice Set', subject: 'Reasoning', category: 'Practice Set', pdfUrl: '#' },
        { title: 'Modern Indian History Timeline', subject: 'History', category: 'Chart/Mindmap', pdfUrl: '#' },
        { title: 'Indian Constitution Quick Revision', subject: 'Polity', category: 'PDF Notes', pdfUrl: '#' },
        { title: 'General Science Physics & Chemistry', subject: 'Science', category: 'Handwritten', pdfUrl: '#' }
    ]
};

window.MOCK_DATA = MOCK_DATA;
