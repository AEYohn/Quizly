"use client";

import { useState, useEffect } from "react";
import { X, User, Check } from "lucide-react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: (firstName: string, lastName: string) => void;
}

export function ProfileModal({ isOpen, onClose, onSave }: ProfileModalProps) {
    const { user: clerkUser } = useUser();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Load existing names
            const savedFirst = localStorage.getItem("quizly_first_name");
            const savedLast = localStorage.getItem("quizly_last_name");

            setFirstName(savedFirst || clerkUser?.firstName || "");
            setLastName(savedLast || clerkUser?.lastName || "");
        }
    }, [isOpen, clerkUser]);

    const handleSave = () => {
        setSaving(true);

        // Save to localStorage
        localStorage.setItem("quizly_first_name", firstName.trim());
        localStorage.setItem("quizly_last_name", lastName.trim());

        // Update display name
        const displayName = firstName.trim() || lastName.trim()
            ? `${firstName.trim()} ${lastName.trim()}`.trim()
            : clerkUser?.username || "User";
        localStorage.setItem("quizly_display_name", displayName);

        if (onSave) {
            onSave(firstName.trim(), lastName.trim());
        }

        setSaving(false);
        onClose();

        // Trigger a page refresh to update all components
        window.location.reload();
    };

    if (!isOpen) return null;

    const profileImage = clerkUser?.imageUrl;
    const initials = (firstName || clerkUser?.firstName || "U").charAt(0).toUpperCase();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Profile Picture */}
                    <div className="flex justify-center">
                        {profileImage ? (
                            <Image
                                src={profileImage}
                                alt="Profile"
                                width={80}
                                height={80}
                                className="h-20 w-20 rounded-full object-cover border-4 border-gray-700"
                            />
                        ) : (
                            <div className="h-20 w-20 rounded-full bg-teal-600 flex items-center justify-center text-2xl font-bold text-white border-4 border-gray-700">
                                {initials}
                            </div>
                        )}
                    </div>

                    {/* Name Fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                First Name
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Enter your first name"
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-teal-500 focus:outline-none transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Last Name
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Enter your last name"
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-teal-500 focus:outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 bg-gray-800/50 rounded-xl">
                        <p className="text-sm text-gray-400 mb-1">Display name preview:</p>
                        <p className="text-lg font-medium text-white">
                            {firstName || lastName
                                ? `${firstName} ${lastName}`.trim()
                                : clerkUser?.username || "User"}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-gray-800">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        <Check className="h-5 w-5" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
