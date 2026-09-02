import { useRef, useState } from 'react';
import { uploadImage } from '../lib/upload';

interface Props {
  label: string;
  value?: string;
  onChange: (url: string) => void;
}

// Replaces "paste an image URL" everywhere in the app with a click/drag
// file picker that uploads straight to Supabase Storage.
export default function ImageUploadField({ label, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label>{label}</label>
      {value ? (
        <div className="image-upload-preview">
          <img src={value} alt="" />
          <button type="button" className="btn btn-sm btn-danger" onClick={() => onChange('')}>
            ✕ Remove
          </button>
        </div>
      ) : (
        <div
          className={`image-upload-drop ${dragOver ? 'image-upload-drop-active' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          {uploading ? '⏳ Uploading…' : '📤 Click or drop an image here'}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: '4px 0 0' }}>{error}</p>}
    </div>
  );
}
