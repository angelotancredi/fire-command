import { useState } from "react";
import { DISTRICTS, getDistance } from "../constants";

export default function DistrictSelector({ onSelect }) {
  const [selectedMain, setSelectedMain] = useState(null);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return alert("GPS를 지원하지 않는 브라우저입니다.");
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      // 가장 가까운 구역 찾기
      let nearest = DISTRICTS[0];
      let minDist = getDistance(latitude, longitude, nearest.center.lat, nearest.center.lng);
      
      DISTRICTS.forEach(d => {
        const dist = getDistance(latitude, longitude, d.center.lat, d.center.lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = d;
        }
      });
      
      onSelect(nearest);
    }, (err) => {
      alert("위치 정보를 가져올 수 없습니다.");
    });
  };

  const modalStyle = {
    position: 'fixed', inset: 0, background: 'rgba(6, 13, 24, 0.9)', backdropFilter: 'blur(15px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50000, padding: 20
  };
  const containerStyle = {
    background: '#0e1925', border: '1px solid #1e3a52', borderRadius: 24, padding: 32,
    maxWidth: 600, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 20px rgba(255, 69, 0, 0.1)'
  };
  const gridStyle = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginTop: 24
  };
  const buttonStyle = (active, isSpecial = false) => ({
    background: active ? 'linear-gradient(135deg, #ff4500, #ff8c00)' : '#0d1f30',
    border: `1px solid ${active || isSpecial ? '#ff4500' : '#1e3a52'}`,
    borderRadius: 12, padding: '16px 12px',
    color: active ? '#fff' : (isSpecial ? '#ff4500' : '#7ec8e3'),
    fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
    textAlign: 'center', boxShadow: active ? '0 10px 20px rgba(255, 69, 0, 0.3)' : 'none',
    gridColumn: isSpecial ? 'span 2' : 'auto'
  });

  return (
    <div style={modalStyle}>
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#ff6030', fontWeight: 700, letterSpacing: 3, marginBottom: 8 }}>ADMINISTRATIVE DISTRICT</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#fff' }}>작전 구역을 선택하세요</div>
        </div>

        {!selectedMain ? (
          <div style={gridStyle}>
            {DISTRICTS.map(d => (
              <button key={d.name} onClick={() => d.subDistricts ? setSelectedMain(d) : onSelect(d)} style={buttonStyle(false)}>
                {d.name}
              </button>
            ))}
            <button key="current-location" onClick={handleCurrentLocation} style={buttonStyle(false, true)}>
              📍 현재 위치로 설정
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0d1f30', padding: '12px 16px', borderRadius: 12, marginBottom: 16 }}>
              <button onClick={() => setSelectedMain(null)} style={{ background: 'none', border: 'none', color: '#7ec8e3', cursor: 'pointer', fontSize: 14 }}>← 이전</button>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{selectedMain.name} 상세 구역</div>
            </div>
            <div style={gridStyle}>
              {selectedMain.subDistricts.map(s => (
                <button key={s.name} onClick={() => onSelect({ ...selectedMain, name: `${selectedMain.name} ${s.name}`, center: { lat: s.lat, lng: s.lng } })} style={buttonStyle(false)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
