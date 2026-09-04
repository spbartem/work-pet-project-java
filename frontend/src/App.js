import './App.css';
import React from 'react';
import { useNavigate, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import SideMenu from './components/SideMenu';
import LoginPage from './components/LoginPage';
import EntPretenseBillStat from './components/EntPretenseBillStat';
import XmlParser from './components/XmlParser';
import Dashboard from './components/DashBoard';
import VckpMoneta from './components/Moneta';
import ReportsPageQuarterly from './components/reports/quarterly/ReportsPage';
import RepDownload from './components/reports/weekly/Rep';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import ProtectedRoute from './components/ProtectedRoute';
import { Add } from '@mui/icons-material';

const theme = createTheme({
    components: {
        MuiListItemIcon: {
            styleOverrides: {
                root: {
                    marginRight: '5px',
                    minWidth: '5px',
                },
            },
        },
        MuiListItem: {
            styleOverrides: {
                root: {
                    cursor: 'pointer',
                },
            },
        },
    },
    typography: {
        fontSize: 10,
        h1: { fontSize: '2rem' },
        body1: { fontSize: '14px', lineHeight: 0.8 },
    },
});

function isTokenValid(token) {
    try {
        const decoded = jwtDecode(token);
        const now = Date.now() / 1000;
        return decoded.exp && decoded.exp > now;
    } catch (e) {
        return false;
    }
}

function App() {
    const token = localStorage.getItem('token');
    const isAuthenticated = token && isTokenValid(token);

    const navigate = useNavigate();
    const location = useLocation();
    const drawerWidth = 20;

    const handleLogin = () => {
        navigate('/dashboard');
    };

    const showSideMenu = location.pathname != '/';

    return (
        <div style={{ display: 'flex' }}>
        {showSideMenu && isAuthenticated && (
            <ThemeProvider theme={theme}>
            <SideMenu />
            </ThemeProvider>
        )}
            <div style={{ flexGrow: 1, marginLeft: `${drawerWidth}px`, padding: '16px' }}>
                <Routes>
                    <Route
                        path="/"
                        element={
                        isAuthenticated
                            ? <Navigate to="/dashboard" replace />
                            : <LoginPage onLogin={handleLogin} />
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                        isAuthenticated
                            ? <Dashboard />
                            : <Navigate to="/" replace />
                        }
                    />
                    <Route
                        path="/ent_pretense_bill_stat"
                        element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                                <EntPretenseBillStat />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/report_quarterly_procuracy"
                        element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                                <ReportsPageQuarterly />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/report_weekly_rep"
                        element={
                            <ProtectedRoute allowedRoles={['ADMIN', 'PAYMENT_CENTER']}>
                                <RepDownload />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/vckp_moneta"
                        element={
                        isAuthenticated
                            ?   <ProtectedRoute allowedRoles={['ADMIN', 'PAYMENT_CENTER']}>
                                    <VckpMoneta />
                                </ProtectedRoute>
                            :   <LoginPage onLogin={handleLogin} />
                        }
                    />
                    <Route
                        path="/xml_parser"
                        element={
                            <ProtectedRoute allowedRoles={['ADMIN']}>
                                <XmlParser />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </div>
        </div>
    );
}

export default App;