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
  const [downloading, setDownloading] = useState(false);
  
  // Состояния для валидации
  const [isValidating, setIsValidating] = useState(false);
  const [selectedXsdType, setSelectedXsdType] = useState('response');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  // Функция для валидации XML
  const validateXml = async () => {
    if (!file) {
      setErrorMessage('Пожалуйста, выберите XML файл');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);
    
    const formData = new FormData();
    formData.append('xmlFile', file);
    
    try {
      const response = await axios.post(
        `${backendUrl}/api/moneta/moneta-sessions/validate-xml?xsdType=${selectedXsdType}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      
      if (response.data.valid) {
        setErrorMessage(null);
        // Показываем успешное сообщение
        const successMsg = document.createElement('div');
        successMsg.className = 'bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-2';
        successMsg.innerHTML = `✅ ${response.data.message}`;
        const container = document.querySelector('.flex.flex-col.gap-4.border.rounded.p-4');
        if (container) {
          const existing = container.querySelector('.validation-message');
          if (existing) existing.remove();
          successMsg.classList.add('validation-message');
          container.insertBefore(successMsg, container.children[2]);
          setTimeout(() => successMsg.remove(), 5000);
        }
      } else {
        setErrorMessage(`❌ ${response.data.message}`);
        if (response.data.errors && response.data.errors.length > 0) {
          console.error('Детали ошибок:', response.data.errors);
        }
      }
    } catch (error) {
      console.error('Ошибка валидации:', error);
      const errorData = error.response?.data;
      if (errorData) {
        setErrorMessage(`❌ ${errorData.message}`);
      } else {
        setErrorMessage('❌ Ошибка при выполнении валидации');
      }
    } finally {
      setIsValidating(false);
      setIsDropdownOpen(false);
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

        client.subscribe('/topic/address-progress', (msg) => {
          const data = JSON.parse(msg.body);

          console.log("📡 Address:", data);

          if (data.error) {
            setFillAddress(false);
            setUploadingPhase(null);
            setServerProgress(0);
            setErrorMessage(data.message || '❌ Произошла ошибка');
            fetchSessions();
            return;
          }

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
        });
      },
    });
    client.activate();
    
    return () => {
      if (client && client.active) {
        client.deactivate();
      }
    };
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

    try {
      const res = await axios.post(`${backendUrl}/api/moneta/start-session`, null, {
        params: { fileName: file.name },
      });

      const sessionId = res.data.sessionId;
      if (sessionId) {
        localStorage.setItem(sessionKey, sessionId);
        fetchSessions();
      }
      
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
      setServerText('Запущено заполнение сумм...');

      await axios.post(`${backendUrl}/api/moneta/moneta-sessions/${sessionId}/fill-sum`);
    } catch (e) {
      console.error('Ошибка при заполнении сумм:', e);
      setFillSum(false);
      setUploadingPhase(null);
      fetchSessions();
    }
  };

  const handleDownloadXml = async (sessionId) => {
    try {
      setErrorMessage(null);
      setDownloading(true);
      setUploadingPhase('downloading');
      setServerText('Скачивание файла...');
      const response = await axios.get(
        `${backendUrl}/api/moneta/moneta-sessions/export/${sessionId}`,
        { responseType: 'blob' }
      );

      const res = await axios.get(`${backendUrl}/api/moneta/moneta-sessions/${sessionId}`);
      const file_name = res.data.fileName;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloading(false);
      fetchSessions();
    } catch (e) {
      console.error('Ошибка при скачивании XML:', e);
      showError('Ошибка при скачивании файла');
      setDownloading(false);
      setUploadingPhase(null);
      fetchSessions();
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Загрузка файла Монеты</h1>

      <div className="flex flex-col gap-4 border rounded p-4 w-full max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          {/* Левая сторона - выбор файла и кнопка Загрузить */}
          <div className="flex items-center gap-4 flex-1">
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button 
              onClick={handleUpload} 
              disabled={uploading || !file}
              className={`px-4 py-2 rounded-md text-white ${
                uploading || !file ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {uploading ? 'Загружается...' : 'Загрузить'}
            </Button>
          </div>
          
          {/* Правая сторона - выбор XSD и кнопка Проверить XML */}
          <div className="flex gap-2">
            {/* Выпадающее меню для выбора типа XSD */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm"
                disabled={isValidating}
              >
                XSD: {selectedXsdType === 'request' ? 'Запрос' : 'Ответ'} ▼
              </button>
              
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-20 border">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setSelectedXsdType('request');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          selectedXsdType === 'request' 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        Запрос
                      </button>
                      <button
                        onClick={() => {
                          setSelectedXsdType('response');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          selectedXsdType === 'response' 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        Ответ
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Кнопка проверки XML */}
            <Button 
              onClick={validateXml} 
              disabled={uploading || !file || isValidating}
              className={`px-4 py-2 rounded-md text-white ${
                (uploading || !file || isValidating) 
                  ? 'bg-gray-400' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isValidating ? 'Проверка...' : 'Проверить XML'}
            </Button>
          </div>
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
            {uploadingPhase === 'sumFilling' && (
              <>
                <p>{serverText || 'Заполнение сумм...'}</p>
                <ProgressIndeterminate />
              </>
            )}
          </>
        )}
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
                    {fillAddress ? 'Заполнение...' : 'Заполнить адреса'} 
                  </Button>
                )}

                {s.statusCode === 'ADDRESS_ENTERED' && (
                  <Button
                    size="sm" 
                    onClick={() => handleFillSum(s.id)}
                    disabled={fillSum}
                    className={`px-4 py-2 rounded-md text-white ${fillSum ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
                  >
                    {fillSum ? 'Заполнение...' : 'Заполнить суммы'} 
                  </Button>
                )}

                {s.statusCode === 'SUM_ENTERED' && (
                  <Button
                    size="sm" 
                    onClick={() => handleDownloadXml(s.id)}
                    disabled={downloading}
                    className={`px-4 py-2 rounded-md text-white ${downloading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
                  >
                    {downloading ? 'Скачивание...' : 'Скачать файл'} 
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