'use client'
import { useState } from 'react';
import { uploadFile } from '@/lib/storage';

export default function TestUpload() {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState('');

  const handleTest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const result = await uploadFile(file, 'evidence');
    setUploading(false);

    if (result.success) {
      setUrl(result.url || '');
      alert('Upload thành công!');
    } else {
      alert('Lỗi: ' + result.error?.message);
    }
  };

  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-4">Test Upload Bucket Evidence</h1>
      <input type="file" onChange={handleTest} disabled={uploading} />
      {uploading && <p>Đang upload...</p>}
      {url && (
        <div className="mt-4">
          <p>Ảnh đã upload:</p>
          <img src={url} alt="Preview" className="w-64 h-auto border" />
          <p className="text-xs break-all mt-2 text-blue-500">{url}</p>
        </div>
      )}
    </div>
  );
}