import React, { useState } from 'react';

const ImageUploader = ({base64Image, setBase64Image, sentOne, fileFormat, setFileFormat}) => {
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    setError('');
    setBase64Image('');

    const file = event.target.files[0];
    if (!file) {
      setError('No file selected.');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please select a PNG, JPG/JPEG, or WEBP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBase64Image(reader.result);
      setFileFormat(file.type);
    };

    reader.onerror = (error) => {
      setError('An error occurred while reading the file.');
      console.error('FileReader Error:', error);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div>
      { ( !sentOne && !base64Image ) &&
        <>
          <form>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={handleFileChange}
              className="rounded-md border-solid border-1 border-aro-800 bg-aro-300 text-black p-1 cursor-pointer mr-4"
            />
          </form>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </>
      }
      {base64Image && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={base64Image} alt="Preview" style={{ maxWidth: '300px', marginTop: '10px' }} />
          <i
            className="fa-solid fa-circle-xmark text-3xl text-morbius-500 cursor-pointer"
            style={{ position: 'absolute', top: '-1em', right: '-1em' }}
            onClick={() => setBase64Image('')}
          />
        </div>
      )}
    </div>
  );
};
export default ImageUploader;