const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyDF9hGu9Tm7lu8-VNT5GcEDazuxQgemgBo",
    authDomain: "nellailearningacademy.firebaseapp.com",
    projectId: "nellailearningacademy",
    storageBucket: "nellailearningacademy.firebasestorage.app",
    messagingSenderId: "806298033830",
    appId: "1:806298033830:web:c826fb77328d033cb35e67"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const mockPages = {
    about: {
        badge: "OUR STORY",
        title: "About NellaiLearningAcademy",
        subtitle: "Empowering the next generation of government officials through high-fidelity learning resources and expert-led guidance.",
        section_title: "Driving Excellence in Public Service Exam Prep",
        description_1: "Founded with a singular vision, NellaiLearningAcademy (NLA) has become a beacon for aspirants aiming for excellence in competitive government exams. We understand the challenges and the dedication required to succeed in exams like SSC, TNPSC, and Banking.",
        description_2: "Our methodology combines traditional wisdom with modern technology, providing a comprehensive ecosystem where every student gets personalized attention and top-tier study materials.",
        stat_1_val: "10K+",
        stat_1_lab: "Active Learners",
        stat_2_val: "500+",
        stat_2_lab: "Exam Toppers",
        stat_3_val: "200+",
        stat_3_lab: "Expert Faculty",
        image_url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80"
    },
    vision: {
        badge: "OUR PURPOSE",
        title: "Vision & Core Values",
        subtitle: "Building a future where high-quality education is accessible to every aspirant regardless of their location or background.",
        vision_title: "A Vision of Empowerment",
        vision_desc_1: "At NLA, we envision a future where every government job aspirant has access to the best guidance and resources. We strive to bridge the gap between hard work and success through structured learning.",
        vision_desc_2: "Our goal is to become the most trusted name in government exam preparation in South India, known for our integrity, innovation, and results-oriented approach.",
        value_1_title: "Integrity First",
        value_1_desc: "We provide honest, transparent guidance and real results. Our content is verified for accuracy and relevance.",
        value_2_title: "Student Success",
        value_2_desc: "Your success is our primary KPI. Every feature we build is designed to improve your exam performance.",
        value_3_title: "Innovation",
        value_3_desc: "We leverage technology to simplify complex topics and make learning engaging and effective."
    },
    success_stories: {
        badge: "OUR PRIDE",
        title: "Success Stories",
        subtitle: "Inspiring journeys of our learners who cracked their dream government jobs with hard work and NLA's guidance.",
        cta_title: "Ready to write your success story?",
        cta_desc: "Join thousands of students who are already preparing with NellaiLearningAcademy and take the first step towards your dream government job.",
        testimonials: [
            {
                name: "Suresh Babu",
                exam: "SSC CGL 2024",
                text: "The mock test series at NLA were exactly like the actual exam. It gave me the confidence to manage time effectively and score high in the mains.",
                avatar_initials: "SB"
            },
            {
                name: "Anitha Nathan",
                exam: "TNPSC Group 2",
                text: "NLA's study materials for Tamil and General Awareness are top-notch. The structured layout made it very easy for me to cover the vast syllabus.",
                avatar_initials: "AN"
            }
        ]
    },
    contact: {
        badge: "GET IN TOUCH",
        title: "Contact NellaiLearningAcademy",
        subtitle: "Have a question? We are here to help. Reach out to our team for any queries regarding our programs or support.",
        address: "PLOT. NO. 18 J J NAGAR C COLONY, REDDIYARPATTI, TIRUNELVELI - 627007",
        email: "admin@gmail.com",
        phone: "9445233717, 9486164832"
    },
    privacy: {
        badge: "LEGAL",
        title: "Privacy Policy",
        subtitle: "Your privacy is our priority. Learn how we handle your data with transparency and care.",
        content: `
            <p>Last updated: March 03, 2026</p>
            <p>Welcome to NellaiLearningAcademy (NLA). This Privacy Policy describes how we collect, use, and handle your information when you use our website and educational services.</p>
            <h2>1. Information We Collect</h2>
            <p>We collect information that you provides directly to us, such as when you create an account, subscribe to a plan, or contact us for support. This may include:</p>
            <ul>
                <li>Full Name and Email Address</li>
                <li>Payment information (processed securely via our partners)</li>
                <li>Educational preferences and progress data</li>
                <li>Log data and device information</li>
            </ul>
            <h2>2. How We Use Your Information</h2>
            <p>We use the collected information for various purposes, including:</p>
            <ul>
                <li>Providing and maintaining our service</li>
                <li>Personalizing your learning experience</li>
                <li>Processing your transactions</li>
                <li>Sending you important updates and newsletters</li>
            </ul>
            <h2>3. Data Protection & Security</h2>
            <p>We implement a variety of security measures to maintain the safety of your personal information. We use state-of-the-art encryption and cloud security protocols (via Firebase) to ensure your data remains confidential and protected from unauthorized access.</p>
            <h2>4. Cookies</h2>
            <p>Our website uses cookies to enhance your experience. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your Web browser that enables the site's or service provider's systems to recognize your browser and capture and remember certain information.</p>
            <h2>5. Third-Party Services</h2>
            <p>We may employ third-party companies and individuals to facilitate our Service. These third parties have access to your Personal Information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.</p>
            <h2>6. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at:</p>
            <p>Email: admin@gmail.com<br>Address: PLOT. NO. 18 J J NAGAR C COLONY, REDDIYARPATTI, TIRUNELVELI - 627007</p>
        `
    },
    terms: {
        badge: "LEGAL",
        title: "Terms of Service",
        subtitle: "Welcome to NellaiLearningAcademy. By using our services, you agree to these terms.",
        content: `
            <p>Last updated: March 03, 2026</p>
            <p>Welcome to NellaiLearningAcademy (NLA). These Terms of Service ("Terms") govern your access to and use of our platform, including our website, mobile applications, and online educational resources.</p>
            <h2>1. Acceptance of Terms</h2>
            <p>By accessing or using our services, you agree to be bound by these Terms and our Privacy Policy. If you do not agree to all of these terms, do not use our platform.</p>
            <h2>2. User Accounts</h2>
            <p>To access certain features of the Service, you must register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information as necessary.</p>
            <ul>
                <li>You are responsible for safeguarding your account password.</li>
                <li>You agree not to disclose your password to any third party.</li>
                <li>You must notify us immediately of any unauthorized use of your account.</li>
            </ul>
            <h2>3. Payment & Subscriptions</h2>
            <p>Certain educational materials and features are available only through paid subscriptions. All payments are processed securely through our authorized payment gateways (e.g., Razorpay).</p>
            <ul>
                <li>Fees are non-refundable except as required by law.</li>
                <li>Subscriptions automatically renew unless canceled.</li>
                <li>NLA reserves the right to change prices with prior notice.</li>
            </ul>
            <h2>4. Intellectual Property</h2>
            <p>All content available on NellaiLearningAcademy, including videos, study materials, mock tests, and branding, is the property of NLA and is protected by copyright and intellectual property laws.</p>
            <ul>
                <li>You are granted a limited, non-exclusive license for personal learning.</li>
                <li>You may not reproduce, distribute, or resell any content from the platform without written permission.</li>
            </ul>
            <h2>5. User Conduct</h2>
            <p>You agree not to use the platform for any unlawful purpose or to engage in any activity that disrupts or interferes with our services. This includes attempting to scrape data, circumvent security measures, or spam other users.</p>
            <h2>6. Termination</h2>
            <p>We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users of the Service.</p>
            <h2>7. Changes to Terms</h2>
            <p>We may modify these Terms at any time. We will provide notice of any changes by posting the new Terms on this page and updating the "Last updated" date.</p>
            <h2>8. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p>
        `
    }
};

async function upload() {
    console.log("Starting mock data upload...");
    for (const [pageId, data] of Object.entries(mockPages)) {
        try {
            await db.collection('company_pages').doc(pageId).set(data);
            console.log(`Successfully uploaded: ${pageId}`);
        } catch (err) {
            console.error(`Error uploading ${pageId}:`, err);
        }
    }
    console.log("Upload complete.");
    process.exit(0);
}

upload();
