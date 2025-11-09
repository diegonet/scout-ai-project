
import React, { useRef } from 'react';
import { CameraIcon } from './Icons';
import { useTranslation } from '../contexts/LanguageContext';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file);
    } else {
      // Basic validation feedback
      alert(t('errorInvalidImage'));
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
      <button
        onClick={handleClick}
        className="w-full md-w-auto flex items-center justify-center px-8 py-4 bg-brand-blue text-white font-bold text-lg rounded-full shadow-lg hover:bg-brand-dark transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-brand-lightblue"
      >
        <CameraIcon className="w-6 h-6 mr-3" />
        {t('uploadPhotoButton')}
      </button>
    </div>
  );
};
