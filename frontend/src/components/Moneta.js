import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { ProgressIndeterminate } from './ui/progress_indeterminate';
import { Table, TableHead, TableRow, TableCell, TableBody } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Pagination } from '../components/ui/pagination';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const backendUrl = process.env.REACT_APP_API_URL;

export default function MonetaUploadPage() {
  const [file, setFile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [serverProgress, setServerProgress] = useState(null);
  const [serverText, setServerText] = useState('');
  const [uploadingPhase, setUploadingPhase] = useState('');
  const [fillAddress, setFillAddress] = useState(false);
  const sessionKey = 'activeMonetaSessionId';
  const [errorMessage, setErrorMessage] = useState(null);
  const [fillSum, setFillSum] = useState(false);

  const addressSessionKey = 'activeAddressSessionId';
  const pageSize = 10;

  const fetchSessions = async (pageIndex = 0) => {
    try {
      const response = await axios.get(`${backendUrl}/api/moneta/moneta-sessions?page=${pageIndex}&size=${pageSize}`);
      setSessions(response.data.content);
      setTotalPages(response.data.totalPages);
    } catch (e) {
      console.error('Ошибка при загрузке сессий:', e);
    }
  };
  
  const pollSavedSession = async (sessionId) => {
    try {
      const res = await axios.get(`${backendUrl}/api/moneta/moneta-sessions/${sessionId}`);
      const session = res.data;
      setServerProgress(Math.round((session.progress || 0) * 100));
      setServerText(session.fileLoaded ? '✅ Завершено' : 'Обработка...');

      if (session.fileLoaded) {
        setUploading(false);
        setUploadingPhase(null);
        localStorage.removeItem(sessionKey);
      }
    } catch (e) {
      console.error('Ошибка:', e);
    }
  };

  useEffect(() => {
    const savedSessionId = localStorage.getItem(sessionKey);
    if (savedSessionId) {
      setUploading(true);
      setUploadingPhase('processing');
      pollSavedSession(savedSessionId);
    }
  }, []);

  useEffect(() => {
  const socket = new SockJS(`${backendUrl}/ws`);
  const client = new Client({
    webSocketFactory: () => socket,
    onConnect: () => {
      console.log('🟢 WebSocket подключен');

      // прогресс обработки XML
      client.subscribe('/topic/progress', (msg) => {
        const data = JSON.parse(msg.body);

        setUploading(true);
        setUploadingPhase('processing');
        fetchSessions();

        if (data.error) {
          setUploading(false);
          setUploadingPhase(null);
          setServerProgress(0);
          setErrorMessage(data.message || '❌ Произошла ошибка');
          return;
        }
        
        console.log("📡 Получено сообщение:", data);
        setServerProgress(data.progress * 100);
        setServerText(data.message);

        if (data.progress >= 1.0) {
          setUploading(false);
          setUploadingPhase(null);
          localStorage.removeItem(sessionKey);
          fetchSessions();
        }
      });

      // прогресс парсинга адресов
      client.subscribe('/topic/address-progress', (msg) => {
        const data = JSON.parse(msg.body);

        console.log("📡 Address:", data);
        console.log("Тип error:", typeof data.error, "Значение:", data.error);

        // ошибка
        if (data.error) {
          setFillAddress(false);
          setUploadingPhase(null);
          setServerProgress(0);
          setErrorMessage(data.message || '❌ Произошла ошибка');
          fetchSessions();
          return;
        }

        // ошибки нет
        setErrorMessage(null);
        setFillAddress(true);
        setUploadingPhase('addressParsing');
        setServerProgress((data.processed || 0) * 100);
        setServerText(data.message || '');

        if (data.process === 'address_final_start') {
          setServerText(data.message);
        }

        if (data.process === 'address_final_end') {
          setFillAddress(false);
          setUploadingPhase(null);
          fetchSessions();
          localStorage.removeItem(addressSessionKey);
        }
      });

      // заполнение сумм
      client.subscribe('/topic/sum-progress', (msg) => {
        const data = JSON.parse(msg.body);

        console.log("Summ: ", data);

        if (data.error || data.res < 0) {
          setFillSum(false);
          setUploadingPhase(null);
          setErrorMessage(data.message || '❌ Произошла ошибка');
          fetchSessions();
          return;       
        }

        
        if (data.process === 'fill_sum_end') {
          setFillSum(false);
          setUploadProgress(null);
          fetchSessions();
        } 
      })     
    },
  });
  client.activate();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, []);

  const showError = (message) => {
    setErrorMessage(message);
    setTimeout(() => {
      setErrorMessage(null);
    }, 10000);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadingPhase('upload');
    setUploadProgress(0);
    setServerProgress(0);
    setServerText('');
    setErrorMessage(null);

    // создание сессии
    try {
      const res = await axios.post(`${backendUrl}/api/moneta/start-session`, null, {
        params: { fileName: file.name },
      });

      const sessionId = res.data.sessionId;
      if (sessionId) {
        localStorage.setItem(sessionKey, sessionId);
        fetchSessions();
      }
      
      // отправка файла
      await axios.put(`${backendUrl}/api/moneta/upload-file?sessionId=${sessionId}`, file, {
        params: { fileName: file.name },
        headers: { 'Content-Type': 'application/octet-stream' },
        onUploadProgress: (e) => {
          setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      setUploadingPhase('processing');
      fetchSessions();
    } catch (e) {
      console.error('Ошибка при загрузке:', e);
      const message = e.response?.data?.message || 'Ошибка при старте сессии';
      showError(message);
      setUploading(false);
      setUploadingPhase(null);
      localStorage.removeItem(sessionKey);
    }
  };

  //блок заполнения адресов
  const handleFillAddresses = async (sessionId) => {
    try {
      setErrorMessage(null);
      setFillAddress(true);
      setUploadingPhase('addressParsing');
      setServerProgress(0);
      setServerText('Запущена обработка адресов...');

      localStorage.setItem(addressSessionKey, sessionId);

      await axios.post(
        `${backendUrl}/api/moneta/moneta-sessions/${sessionId}/fill-addresses`
      );

    } catch (e) {
      console.error('Ошибка при заполнении адресов:', e);
      setFillAddress(false);
      setUploadingPhase(null);
      fetchSessions();
    }
  };

  useEffect(() => {
  const savedAddressSessionId = localStorage.getItem(addressSessionKey);

  if (savedAddressSessionId) {
      setFillAddress(true);
      setUploadingPhase('addressParsing');
      pollAddressSession(savedAddressSessionId);
    }
  }, []);

  const pollAddressSession = async (sessionId) => {
    try {
      const res = await axios.get(
        `${backendUrl}/api/moneta/moneta-sessions/${sessionId}`
      );

      const session = res.data;

      if (session.statusCode === 'ADDRESS_PARSING') {
        setServerProgress((session.addressProgress || 0) * 100);
        setServerText(session.addressMessage || 'Парсинг адресов...');

        setTimeout(() => pollAddressSession(sessionId), 2000);
      } else {
        setFillAddress(false);
        setUploadingPhase(null);
        localStorage.removeItem(addressSessionKey);
        fetchSessions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFillSum = async (sessionId) => {
    try {
      setErrorMessage(null);
      setFillSum(true);
      setUploadingPhase('sumFilling');
      setServerText('Запущено заполнение сумм...')

      await axios.post(`${backendUrl}/api/moneta/moneta-sessions/${sessionId}/fill-sum`)

    } catch (e) {
      console.error('Ошибка при заполнении сумм:', e);
      setFillSum(false);
      setUploadingPhase(null);
      fetchSessions();
    }
  };

  const handleDownloadXml = async (sessionId) => {
  try {
    const response = await axios.get(
      `${backendUrl}/api/moneta/moneta-sessions/export/${sessionId}`,
      { responseType: 'blob' }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `QR_140440_${sessionId}.xml`);
    document.body.appendChild(link);
    link.click();
    link.remove();

  } catch (e) {
    console.error('Ошибка при скачивании XML:', e);
    showError('Ошибка при скачивании файла');
  }
};

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Загрузка файла Монеты</h1>

      <div className="flex flex-col gap-4 border rounded p-4 w-full max-w-3xl">
        <div className="flex items-center gap-4">
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button 
            onClick={handleUpload} 
            disabled={uploading || !file}
            className={`px-4 py-2 rounded-md text-white ${uploading || !file ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {uploading ? 'Загружается...' : 'Загрузить'}
          </Button>
        </div>

        {uploading && (
          <>
            {uploadingPhase === 'upload' && (
              <>
                <p>Загрузка файла: {uploadProgress}%</p>
                <Progress value={uploadProgress} />
              </>
            )}

            {uploadingPhase === 'processing' && (
              <>
                <p>{serverText || 'Обработка файла...'}</p>
                <Progress value={serverProgress} />
              </>
            )}
          </>
        )}

        {fillAddress && (
          <>
            {uploadingPhase === 'addressParsing' && (
              <>
                <p>{serverText || 'Парсинг адресов...'}</p>
                <Progress value={serverProgress} />
              </>
            )}
          </>
        )}

        {fillSum && (
          <>
            {
             uploadingPhase === 'sumFilling' && (
              <>
                <p>{serverText || 'Заполнение сумм...'}</p>
                <ProgressIndeterminate />
              </>
             ) 
            }
          </>
        )

        }
      </div>

      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
          ❌ {errorMessage}
        </div>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Имя файла</TableCell>
            <TableCell>Кол-во строк</TableCell>
            <TableCell>Статус</TableCell>
            <TableCell>Действия</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sessions.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.id}</TableCell>
              <TableCell>{s.fileName}</TableCell>
              <TableCell>{s.countRowMoneta}</TableCell>
              <TableCell>{s.statusName}</TableCell>
              <TableCell>
                {s.statusCode === 'FILE_PARSING' && (
                  <Button
                    size="sm" 
                    onClick={() => handleFillAddresses(s.id)}
                    disabled={fillAddress}
                    className={`px-4 py-2 rounded-md text-white ${fillAddress ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
                  >
                    {fillAddress  ? 'Заполнение...'  : 'Заполнить адреса'} 
                  </Button>
                )}

                {s.statusCode === 'ADDRESS_ENTERED' && (
                  <Button
                    size="sm" 
                    onClick={() => handleFillSum(s.id)}
                    disabled={fillAddress}
                  >
                    {fillAddress  ? 'Заполнение...'  : 'Заполнить суммы'} 
                  </Button>
                )}

                {s.statusCode === 'SUM_ENTERED' && (
                  <Button
                    size="sm" 
                    onClick={() => handleDownloadXml(s.id)}
                    disabled={fillSum}
                  >
                    {fillSum  ? 'Заполнение...'  : 'Скачать файл'} 
                  </Button>
                )}

              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(newPage) => {
          setPage(newPage);
          fetchSessions(newPage);
        }}
      />
    </div>
  );
}
