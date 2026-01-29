"use client";

import Link from "next/link";
import { Sparkles, ArrowLeft, Shield, Database, Eye, Lock, Users, Mail, Clock } from "lucide-react";

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-gray-950">
            {/* Nav */}
            <nav className="fixed top-0 z-50 w-full bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                            <Sparkles className="h-5 w-5 text-gray-900" />
                        </div>
                        <span className="text-xl font-bold text-white">Quizly</span>
                    </Link>
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </div>
            </nav>

            {/* Content */}
            <div className="pt-24 pb-16 px-6">
                <article className="mx-auto max-w-3xl">
                    {/* Header */}
                    <header className="mb-12 text-center">
                        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gray-900 border border-gray-800 mb-6">
                            <Shield className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
                        <p className="text-gray-400">
                            Last updated: January 29, 2025
                        </p>
                    </header>

                    {/* Prose Content */}
                    <div className="prose prose-invert prose-gray max-w-none">
                        {/* Introduction */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Eye className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Introduction</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>
                                    Welcome to Quizly. We are committed to protecting your privacy and ensuring
                                    the security of your personal information. This Privacy Policy explains how
                                    we collect, use, disclose, and safeguard your information when you use our
                                    AI-powered learning platform.
                                </p>
                                <p>
                                    By using Quizly, you agree to the collection and use of information in
                                    accordance with this policy. If you do not agree with our policies and
                                    practices, please do not use our service.
                                </p>
                            </div>
                        </section>

                        {/* Information We Collect */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Database className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Information We Collect</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-6">
                                {/* Account Information */}
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-2">Account Information</h3>
                                    <p className="mb-2">
                                        When you create an account, we collect:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Name and email address</li>
                                        <li>Role (teacher or student)</li>
                                        <li>Authentication data managed through Clerk</li>
                                        <li>Profile information you choose to provide</li>
                                    </ul>
                                </div>

                                {/* Learning Data */}
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-2">Learning Data</h3>
                                    <p className="mb-2">
                                        To provide personalized learning experiences, we collect:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Quiz responses and answers</li>
                                        <li>Concept mastery scores and progress</li>
                                        <li>Exit ticket responses and completion status</li>
                                        <li>Discussion transcripts with AI tutors</li>
                                        <li>Identified misconceptions and learning patterns</li>
                                        <li>Study materials you create (flashcards, notes, games)</li>
                                    </ul>
                                </div>

                                {/* Usage Data */}
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-2">Usage Data</h3>
                                    <p className="mb-2">
                                        We automatically collect certain information when you use our service:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>Device information and browser type</li>
                                        <li>IP address and approximate location</li>
                                        <li>Pages visited and features used</li>
                                        <li>Time spent on activities</li>
                                        <li>Error logs and performance data</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        {/* How We Use Your Information */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Lock className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">How We Use Your Information</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>We use the information we collect to:</p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>Provide and maintain our learning platform</li>
                                    <li>Personalize your learning experience with adaptive content</li>
                                    <li>Generate AI-powered study materials and recommendations</li>
                                    <li>Track your progress and identify areas for improvement</li>
                                    <li>Enable teachers to monitor class performance and provide targeted help</li>
                                    <li>Improve our AI models and educational content</li>
                                    <li>Communicate with you about your account and updates</li>
                                    <li>Detect and prevent fraud, abuse, and security issues</li>
                                </ul>
                            </div>
                        </section>

                        {/* Data Sharing */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Users className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Data Sharing</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>
                                    We do not sell your personal information. We may share your data with:
                                </p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>
                                        <strong className="text-white">Teachers:</strong> Student learning data
                                        is shared with teachers for educational purposes within classroom contexts
                                    </li>
                                    <li>
                                        <strong className="text-white">Clerk:</strong> Our authentication provider
                                        that securely manages your login credentials
                                    </li>
                                    <li>
                                        <strong className="text-white">Google Gemini:</strong> Your quiz responses
                                        and learning interactions are processed by Gemini AI to generate personalized
                                        feedback and study materials
                                    </li>
                                    <li>
                                        <strong className="text-white">Sentry:</strong> Error monitoring service
                                        that helps us identify and fix technical issues (does not include learning content)
                                    </li>
                                    <li>
                                        <strong className="text-white">Legal Requirements:</strong> When required
                                        by law or to protect our rights and safety
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* Data Retention */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Data Retention</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>
                                    We retain your personal information for as long as your account is active
                                    or as needed to provide you services. We will retain and use your information
                                    as necessary to:
                                </p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>Comply with our legal obligations</li>
                                    <li>Resolve disputes and enforce our agreements</li>
                                    <li>Maintain educational records as required by law</li>
                                </ul>
                                <p>
                                    You may request deletion of your account and associated data at any time
                                    through your account settings or by contacting us.
                                </p>
                            </div>
                        </section>

                        {/* Your Rights */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Shield className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Your Rights</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>You have the right to:</p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>
                                        <strong className="text-white">Access:</strong> Request a copy of all
                                        personal data we hold about you
                                    </li>
                                    <li>
                                        <strong className="text-white">Export:</strong> Download your data in
                                        a portable format (JSON)
                                    </li>
                                    <li>
                                        <strong className="text-white">Correction:</strong> Update or correct
                                        inaccurate personal information
                                    </li>
                                    <li>
                                        <strong className="text-white">Deletion:</strong> Request deletion of
                                        your account and associated data
                                    </li>
                                    <li>
                                        <strong className="text-white">Restriction:</strong> Request that we
                                        limit processing of your data in certain circumstances
                                    </li>
                                    <li>
                                        <strong className="text-white">Objection:</strong> Object to processing
                                        of your data for certain purposes
                                    </li>
                                </ul>
                                <p>
                                    To exercise these rights, please visit your account settings or contact us
                                    at the email address below.
                                </p>
                            </div>
                        </section>

                        {/* Data Security */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Lock className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Data Security</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>
                                    We implement appropriate technical and organizational measures to protect
                                    your personal information, including:
                                </p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>Encryption of data in transit and at rest</li>
                                    <li>Secure authentication through Clerk</li>
                                    <li>Regular security assessments and monitoring</li>
                                    <li>Access controls and audit logging</li>
                                    <li>Employee training on data protection</li>
                                </ul>
                                <p>
                                    While we strive to protect your information, no method of transmission
                                    over the Internet is 100% secure. We cannot guarantee absolute security.
                                </p>
                            </div>
                        </section>

                        {/* Children's Privacy */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Users className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Children&apos;s Privacy</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>
                                    Quizly is designed for educational use and may be used by students of
                                    various ages under teacher supervision. We are committed to protecting
                                    children&apos;s privacy in compliance with applicable laws including COPPA.
                                </p>
                                <p>
                                    For users under 13, we:
                                </p>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>Collect only information necessary for educational purposes</li>
                                    <li>Do not use personal information for targeted advertising</li>
                                    <li>Allow parents and teachers to review and delete children&apos;s data</li>
                                    <li>Require parental or school consent where required by law</li>
                                </ul>
                                <p>
                                    Parents and guardians may contact us to review, delete, or manage their
                                    child&apos;s information.
                                </p>
                            </div>
                        </section>

                        {/* Changes to Policy */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Changes to This Policy</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>
                                    We may update this Privacy Policy from time to time. We will notify you
                                    of any changes by posting the new Privacy Policy on this page and updating
                                    the &quot;Last updated&quot; date.
                                </p>
                                <p>
                                    For significant changes, we will provide additional notice through email
                                    or a prominent notice on our platform. We encourage you to review this
                                    Privacy Policy periodically.
                                </p>
                            </div>
                        </section>

                        {/* Contact Us */}
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="h-5 w-5 text-gray-500" />
                                <h2 className="text-2xl font-semibold text-white m-0">Contact Us</h2>
                            </div>
                            <div className="pl-8 text-gray-300 space-y-4">
                                <p>
                                    If you have any questions about this Privacy Policy or our data practices,
                                    please contact us:
                                </p>
                                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                                    <p className="mb-2">
                                        <strong className="text-white">Email:</strong>{" "}
                                        <a href="mailto:privacy@quizly.app" className="text-blue-400 hover:text-blue-300">
                                            privacy@quizly.app
                                        </a>
                                    </p>
                                    <p className="mb-0">
                                        <strong className="text-white">Response Time:</strong>{" "}
                                        We aim to respond to all privacy-related inquiries within 30 days.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                </article>
            </div>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-gray-800">
                <div className="mx-auto max-w-4xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-gray-600" />
                            <span className="font-bold text-white">Quizly</span>
                        </div>
                        <p className="text-sm text-gray-600">
                            Powered by Gemini AI
                        </p>
                    </div>
                </div>
            </footer>
        </main>
    );
}
