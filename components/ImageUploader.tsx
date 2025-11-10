
import React, { useRef } from 'react';
import { CameraIcon } from './Icons';
import { useTranslation } from '../contexts/LanguageContext';

/**
 * Props for the ImageUploader component.
 */
interface ImageUploaderProps {
  /** * Callback function executed when a valid image file is selected.
   * @param {File} file - The selected image file object.
   */
  onImageSelect: (file: File) => void;
}

/**
 * A component that provides a styled button to trigger file selection 
 * for image uploads. It handles file validation and calls a callback function
 * with the selected image file.
 * @param {ImageUploaderProps} props - The component props.
 */
export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  /**
   * Handles the change event from the hidden file input.
   * Validates the file type and passes the file to the onImageSelect callback.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file);
    } else {
      // Basic validation feedback
      alert(t('errorInvalidImage'));
    }
  };

  /**
   * Triggers a click event on the hidden file input element.
   */
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
