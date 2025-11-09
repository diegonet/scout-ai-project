import React from 'react';
import { CheckCircleIcon, LoaderIcon, CircleIcon } from './Icons';
import { useTranslation } from '../contexts/LanguageContext';

type StepStatus = 'completed' | 'in-progress' | 'pending';

const getStepStatus = (stepIndex: number, currentStepIndex: number): StepStatus => {
  if (stepIndex < currentStepIndex) return 'completed';
  if (stepIndex === currentStepIndex) return 'in-progress';
  return 'pending';
};

const StatusIcon: React.FC<{ status: StepStatus }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon className="w-8 h-8 text-green-500" />;
    case 'in-progress':
      return <LoaderIcon className="w-8 h-8 text-brand-blue animate-spin" />;
    case 'pending':
      return <CircleIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />;
  }
};

export const LoadingState: React.FC<{ message: string }> = ({ message }) => {
  const { t } = useTranslation();

  const STEPS = [
    { id: 1, nameKey: 'loadingStep1', messageKeyword: t('loadingPreparing') },
    { id: 2, nameKey: 'loadingStep2', messageKeyword: t('loadingIdentifying') },
    { id: 3, nameKey: 'loadingStep3', messageKeyword: t('loadingResearching') },
    { id: 4, nameKey: 'loadingStep4', messageKeyword: t('loadingCreatingAudio') },
  ];

  const currentStepIndex = STEPS.findIndex(step => message.includes(step.messageKeyword));
  // Default to the first step if no keyword matches yet
  const activeStep = currentStepIndex !== -1 ? currentStepIndex : 0;

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md">
      <h2 className="text-2xl font-bold text-brand-dark dark:text-white mb-6">{t('loadingTitle')}</h2>
      
      <div className="w-full space-y-4 mb-8 pl-4">
        {STEPS.map((step, index) => {
          const status = getStepStatus(index, activeStep);
          const isCompleted = status === 'completed';
          const isInProgress = status === 'in-progress';
          
          return (
            <div key={step.id} className="flex items-center space-x-4 transition-all duration-300">
              <StatusIcon status={status} />
              <span className={`text-lg font-semibold ${
                isCompleted ? 'text-gray-900 dark:text-gray-300' : 
                isInProgress ? 'text-brand-dark dark:text-white' : 
                'text-gray-400 dark:text-gray-500'
              }`}>
                {t(step.nameKey)}
              </span>
            </div>
          );
        })}
      </div>
      
      <p className="text-gray-600 dark:text-gray-400 h-6 min-h-[1.5rem]">{message}</p>
    </div>
  );
};