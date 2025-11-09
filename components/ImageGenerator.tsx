import React, { useState, useRef } from 'react';
import { generateTourPlan } from '../services/geminiService';
import type { TourPlan } from '../types';
import { CalendarDaysIcon, LoaderIcon, SparklesIcon, DownloadIcon } from './Icons';
import { useTranslation } from '../contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../utils/translations';

// Tell TypeScript about the global variables from the script tags
// @ts-ignore
const { jsPDF } = window.jspdf;
declare const html2canvas: any;

// Simple icons for different sections of the plan
const MorningIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>;
const FoodIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>; // A generic icon for food
const EveningIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>;

export const TourPlanner: React.FC = () => {
    const [location, setLocation] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [plan, setPlan] = useState<TourPlan | null>(null);
    const planRef = useRef<HTMLDivElement>(null);
    const { language, t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!location.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setPlan(null);

        const langName = SUPPORTED_LANGUAGES.find(l => l.code === language)?.name || 'English';

        try {
            const tourPlan = await generateTourPlan(location, langName);
            setPlan(tourPlan);
        } catch (err) {
            const message = err instanceof Error ? err.message : t('errorUnknown');
            setError(`${t('errorTourPlan')} ${message}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        setLocation('');
        setPlan(null);
        setError(null);
    };

    const handleDownloadPdf = async () => {
        const element = planRef.current;
        if (!element || isDownloading) return;

        setIsDownloading(true);
        setError(null);
        try {
            const canvas = await html2canvas(element, {
                 scale: 2, // Higher resolution for better quality
                 useCORS: true,
                 backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProperties = pdf.getImageProperties(imgData);
            const imgRatio = imgProperties.height / imgProperties.width;
            
            let imgWidth = pdfWidth - 20; // 10mm margin on each side
            let imgHeight = imgWidth * imgRatio;

            // If the image height is still greater than the page height, scale by height
            if (imgHeight > pdfHeight - 20) {
                imgHeight = pdfHeight - 20; // 10mm margin top/bottom
                imgWidth = imgHeight / imgRatio;
            }

            const x = (pdfWidth - imgWidth) / 2; // Center horizontally
            const y = 10; // 10mm top margin

            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`tour-plan-${plan?.location.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            setError(t('errorPdf'));
        } finally {
            setIsDownloading(false);
        }
    };


    if (isLoading) {
        return (
             <div className="text-center p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
                <LoaderIcon className="w-16 h-16 mx-auto text-brand-blue animate-spin mb-4" />
                <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-2">{t('tourPlannerLoadingTitle')}</h2>
                <p className="text-gray-600 dark:text-gray-300">{t('tourPlannerLoadingSubtitle')}</p>
            </div>
        )
    }
    
    if (plan) {
        return (
             <div className="w-full max-w-2xl text-left animate-fade-in">
                <div ref={planRef} className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-6 md:p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700">
                   <h2 className="text-3xl font-bold text-brand-dark dark:text-white mb-1 text-center">{plan.title}</h2>
                   <p className="text-center text-gray-600 dark:text-gray-300 mb-6">{t('tourPlannerSubtitle', { location: plan.location })}</p>

                   <div className="space-y-6">
                        {/* Morning */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300 flex items-center justify-center"><MorningIcon /></div>
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark dark:text-white">{t('morning')}: {plan.morning.activity}</h3>
                                <p className="text-gray-600 dark:text-gray-300">{plan.morning.description}</p>
                            </div>
                        </div>

                        {/* Lunch */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300 flex items-center justify-center"><FoodIcon /></div>
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark dark:text-white">{t('lunch')}: {plan.lunch.suggestion}</h3>
                                <p className="text-gray-600 dark:text-gray-300">{plan.lunch.description}</p>
                            </div>
                        </div>
                        
                        {/* Afternoon */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300 flex items-center justify-center"><SparklesIcon /></div>
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark dark:text-white">{t('afternoon')}: {plan.afternoon.activity}</h3>
                                <p className="text-gray-600 dark:text-gray-300">{plan.afternoon.description}</p>
                            </div>
                        </div>

                         {/* Evening */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 flex items-center justify-center"><EveningIcon /></div>
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark dark:text-white">{t('evening')}: {plan.evening.activity}</h3>
                                <p className="text-gray-600 dark:text-gray-300">{plan.evening.description}</p>
                            </div>
                        </div>

                        {/* Dinner */}
                         <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300 flex items-center justify-center"><FoodIcon /></div>
                            <div>
                                <h3 className="font-bold text-lg text-brand-dark dark:text-white">{t('dinner')}: {plan.dinner.suggestion}</h3>
                                <p className="text-gray-600 dark:text-gray-300">{plan.dinner.description}</p>
                            </div>
                        </div>

                   </div>
                </div>
                 {error && <p className="text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-lg text-center mt-4">{error}</p>}
                   <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
                        <button
                            onClick={handleDownloadPdf}
                            disabled={isDownloading}
                            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-white dark:bg-gray-700 text-brand-blue dark:text-white border border-brand-blue dark:border-gray-600 font-bold text-base rounded-full shadow-lg hover:bg-brand-lightblue dark:hover:bg-gray-600 transform hover:scale-105 transition-all duration-300 ease-in-out disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            {isDownloading ? (
                                <>
                                    <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                                    {t('downloadingButton')}
                                </>
                            ) : (
                                <>
                                    <DownloadIcon className="w-5 h-5 mr-2" />
                                    {t('downloadPdfButton')}
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleReset}
                            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-brand-blue text-white font-bold text-base rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out"
                        >
                            {t('planAnotherTripButton')}
                        </button>
                   </div>
            </div>
        );
    }

    return (
        <div className="text-center p-4 sm:p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md animate-fade-in flex flex-col justify-center md:min-h-[450px]">
            <CalendarDaysIcon className="w-16 h-16 mx-auto text-brand-blue mb-4" />
            <h1 className="text-4xl md:text-5xl font-extrabold text-brand-dark dark:text-white mb-4">
                {t('tourPlannerTitle')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
                {t('tourPlannerDescription')}
            </p>
            <form onSubmit={handleSubmit} className="w-full flex flex-col items-center space-y-6">
                <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t('tourPlannerPlaceholder')}
                    className="w-full text-center p-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition-colors"
                    required
                />
                
                {error && <p className="w-full text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 p-3 rounded-lg">{error}</p>}
                <button
                    type="submit"
                    disabled={isLoading || !location.trim()}
                    className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-brand-blue text-white font-bold text-lg rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-brand-lightblue disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    <SparklesIcon className="w-6 h-6 mr-3" />
                    {t('generatePlanButton')}
                </button>
            </form>
        </div>
    );
};