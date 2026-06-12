import { useState } from 'react';

export default function App() {
  const [bookId, setBookId] = useState('');

  const upload = async (e: any) => {
    const formData = new FormData();
    formData.append('pdf', e.target.files[0]);
    const res = await fetch('/api/books/upload', { method: 'POST', body: formData });
    const data = await res.json();
    setBookId(data.bookId);
  };

  const generate = async () => {
    await fetch(`/api/books/${bookId}/generate`, { method: 'POST' });
    alert('NAV и UTILITY созданы!');
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>BOOK-NAV V1</h1>
      <input type="file" onChange={upload} />
      {bookId && (
        <div style={{ marginTop: 20 }}>
          <button onClick={generate}>Generate NAV & UTILITY</button>
          <div style={{ marginTop: 10 }}>
            <a href={`/api/books/${bookId}/download-nav`}>Скачать NAV.md</a> | 
            <a href={`/api/books/${bookId}/download-utility`}> Скачать UTILITY.md</a>
          </div>
        </div>
      )}
    </div>
  );
}