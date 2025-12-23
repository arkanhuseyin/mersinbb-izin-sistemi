import { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, RefreshCw } from 'lucide-react';

export default function SystemLogs() {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        verileriCek();
    }, []);

    const verileriCek = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get('https://mersinbb-izin-sistemi.onrender.com/api/izin/system-logs', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(res.data);
        } catch (e) { console.error(e); }
    };

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3 className="fw-bold text-dark"><Shield className="me-2"/> Sistem Güvenlik Logları</h3>
                <button className="btn btn-light border" onClick={verileriCek}><RefreshCw size={18}/></button>
            </div>
            
            <div className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-dark text-white small text-uppercase">
                                <tr>
                                    <th className="ps-4 py-3">Tarih</th>
                                    <th>Personel</th>
                                    <th>İşlem</th>
                                    <th>Detay</th>
                                    <th>IP Adresi</th>
                                </tr>
                            </thead>
                            <tbody className="small">
                                {logs.map((log, i) => (
                                    <tr key={i} className="border-bottom">
                                        <td className="ps-4">{new Date(log.tarih).toLocaleString()}</td>
                                        <td className="fw-bold">{log.ad} {log.soyad} <br/><span className="text-muted fw-normal">{log.tc_no}</span></td>
                                        <td><span className="badge bg-secondary">{log.islem}</span></td>
                                        <td>{log.detay}</td>
                                        <td className="font-monospace text-muted">{log.ip_adresi}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}