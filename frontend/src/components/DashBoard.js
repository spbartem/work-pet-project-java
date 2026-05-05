import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const backendUrl = process.env.REACT_APP_API_URL;

// Стилизуем контейнер для позиционирования календаря
const containerStyle = {
  position: "relative",
  display: "flex",
  alignItems: "center", // Выравнивает label и input по центру
  gap: "8px",           // Контролируемый отступ
  backgroundColor: "#f0f8ff", // Пример заливки, если хочешь видеть фон
  padding: "5px",
  borderRadius: "4px"
};

const calendarPopupStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  zIndex: 1000,
  border: "1px solid #ccc",
  borderRadius: "4px",
  background: "#fff",
  padding: "4px 8px"
};

const commonInputStyle = {
  padding: "4px 8px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "1rem",
  lineHeight: "1.2",
  height: "30px",
  width: "120px",     
  boxSizing: "border-box",
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: "white", padding: 10, border: "1px solid #ccc", borderRadius: 5 }}>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: 0 }}>
            <b>{entry.name}:</b> {entry.value.toLocaleString()} ₽
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#FF9999"];

export function useOutsideClick(refs, handler, active = true) {
  useEffect(() => {
    if (!active) return;

    function handleClick(event) {
      const isOutside = refs.every(
        (ref) => ref.current && !ref.current.contains(event.target)
      );

      if (isOutside) {
        handler();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [refs, handler, active]);
}

export default function Dashboard() {
  const [dataDebtOperational, setDataDebtOperational] = useState(null);
  const [availableDatesVr, setAvailableDatesVr] = useState([]);
  const [availableDatesOperational, setAvailableDateOperational] = useState([]);
  const [selectedDateVr, setSelectedDateVr] = useState(null);
  const [selectedDateOperational, setSelectedDateOperational] = useState("");
  const [selectedDecision, setSelectedDecision] = useState(3);
  const [dataVrByPeriod, setDataVrByPeriod] = useState(null);

  const [isOpenOp, setIsOpenOp] = useState(false);
  const [isOpenVr, setIsOpenVr] = useState(false);

  const containerRefVr = useRef(null);
  const calendarRefVr = useRef(null);
  const containerRefOp = useRef(null);
  const calendarRefOp = useRef(null);

  const [calendarViewDate, setCalendarViewDate] = useState(selectedDateVr || new Date());

  // Конвертируем строки с сервера в Date для фильтра
  const dateObjectsVr = availableDatesVr.map((d) => new Date(d));
  const allowedTimeStampsVr = new Set(dateObjectsVr.map((d) => d.getTime()));

  const dateObjectsOp = availableDatesOperational.map((d) => new Date(d));
  const allowedTimeStampsOp = new Set(dateObjectsOp.map((d) => d.getTime()));

  const formatDate = (date) => {
    return date
      ? new Date(date).toLocaleDateString("ru-RU")
      : "";
  };

  useEffect(() => {
      axios.get(`${backendUrl}/api/debt/availableDatesVr`)
        .then(res => {
          const dates = res.data.map(d => {
            const dt = new Date(d);
            dt.setHours(0, 0, 0, 0)
            return dt;
          });
          setAvailableDatesVr(dates);
          if (dates.length) {
            const latestDate = res.data.sort((a, b) => new Date(b) - new Date(a))[0]; // сортируем по убыванию
            setSelectedDateVr(latestDate); 
          }
        })
      .catch(console.error);

      axios.get(`${backendUrl}/api/debt/availableDatesOperational`)
        .then(res => {
          const dates = res.data.map(d => {
            const dt = new Date(d);
            dt.setHours(0, 0, 0, 0)
            return dt;
          });
          setAvailableDateOperational(dates);
          if (dates.length) {
            const latestDate = dates.sort((a, b) => new Date(b) - new Date(a))[0];
            setSelectedDateOperational(latestDate);
          }
        })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedDateVr) {
      axios.get(`${backendUrl}/api/debt/vr-by-period?localDate=${formattedDateVr}&decisionType=${selectedDecision}`)
        .then(res => setDataVrByPeriod(res.data))
        .catch(console.error);
    }
  }, [selectedDateVr, selectedDecision]);

  useEffect(() => {
    if (selectedDateOperational) {
      axios.get(`${backendUrl}/api/debt/operational-by-period?localDate=${formattedDateOp}`)
        .then(res => setDataDebtOperational(res.data))
        .catch(console.error);      
    }
  }, [selectedDateOperational]);

  //закрыть календарь при клике в любом месте окна
  useOutsideClick([containerRefVr, calendarRefVr], () => {
    setIsOpenVr(false);
  }, isOpenVr);

    useOutsideClick([containerRefOp, calendarRefOp], () => {
    setIsOpenOp(false);
  }, isOpenOp);

  const formattedDateVr = selectedDateVr instanceof Date
  ? `${selectedDateVr.getFullYear()}-${String(selectedDateVr.getMonth() + 1).padStart(2,'0')}-${String(selectedDateVr.getDate()).padStart(2,'0')}`
  : selectedDateVr;

  const formattedDateOp = selectedDateOperational instanceof Date
  ? `${selectedDateOperational.getFullYear()}-${String(selectedDateOperational.getMonth() + 1).padStart(2,'0')}-${String(selectedDateOperational.getDate()).padStart(2,'0')}`
  : selectedDateOperational;

  if (!dataDebtOperational || !availableDatesVr.length) return <div>Загрузка...</div>;

  const chartDataDebtOperational = [
    { name: "До 3-х мес.", value: dataDebtOperational.debtOperationalLess3m },
    { name: "3 - 7 мес.", value: dataDebtOperational.debtOperationalBetween3mAnd7m },
    { name: "7 мес. - 2 года", value: dataDebtOperational.debtOperationalBetween7mAnd2y },
    { name: "2 - 3 года", value: dataDebtOperational.debtOperationalBetween2yAnd3y },
    { name: "Более 3-х лет", value: dataDebtOperational.debtOperationalMore3y },
  ];

  const chartDataVrByPeriod = dataVrByPeriod
    ? dataVrByPeriod
      ?.filter(row => row.type === "by_period" && row.id !== 1)
      .map((row) => ({ name: row.division, value: row.totalAmount }))
    : [];

  const debt_start_year = dataVrByPeriod.find((row) => row.type === 'debt_start_year')?.totalAmount;
  const current_debt = dataVrByPeriod.find((row) => row.type && row.id === 1)?.totalAmount;

  const debt_diff = debt_start_year
  ? ((current_debt - debt_start_year) / debt_start_year) * 100
  : 0;

  const debt_diff_sum = debt_start_year
  ? (current_debt - debt_start_year)
  : 0;

  const isPositiveDebt = debt_diff > 0;
  const isNegativeDebt = debt_diff < 0;

return (
  <div style={{ padding: 0 }}>
    <div style={{ display: "flex", flexDirection: "row", gap: 5, width: "100%" }}>

      {/* Задолженность по Минстрою */}
      <div className="border-main-div" style={{ flexDirection: "column",  minWidth: 0, borderRadius: "8px" }}>
        {/* Фильтры */}
        <div style={{ marginBottom: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 className="text-base text-center m-0 font-bold">
            Задолженность по Минстрою
          </h3>
          <div style={containerStyle} ref={containerRefVr}>
            <label className="my-label">Отчётная дата:</label>
            <input
              type="text"
              readOnly
              value={formatDate(selectedDateVr)}
              placeholder="дд.мм.гггг"
              onClick={() => setIsOpenVr((prev) => !prev)}
              style={ commonInputStyle }
            />
            {isOpenVr && (
              <div style={calendarPopupStyle}>
                <div style={calendarPopupStyle} ref={calendarRefVr}>
                  <Calendar
                    onChange={(date) => {
                      setSelectedDateVr(date);
                      setCalendarViewDate(date);
                      setIsOpenVr(false);
                    }}
                    tileDisabled={({ date }) => {
                        const normalized = new Date(date);
                        normalized.setHours(0, 0, 0, 0); 
                        return !allowedTimeStampsVr.has(normalized.getTime());
                    }}
                    activeStartDate={calendarViewDate}
                    onActiveStartDateChange={({ activeStartDate }) =>
                    setCalendarViewDate(activeStartDate)
                    }
                    minDate={
                      new Date(Math.min(...Array.from(allowedTimeStampsVr)))
                    }
                    maxDate={
                      new Date(Math.max(...Array.from(allowedTimeStampsVr)))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div style={containerStyle} ref={containerRefVr}>
            <label className="my-label">СФФКР:</label>
            <select 
              value={ selectedDecision } 
              onChange={(e) => setSelectedDecision(Number(e.target.value))}
              style={ commonInputStyle }
            >
              <option value={1}>РО</option>
              <option value={2}>Спец. счёт РО</option>
              <option value={3}>Итого</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 10, flex: 1}}>
          <div
            style={{
              display: "flex",
              flexDirection: "column", // вертикальное размещение
              justifyContent: "space-between", // пространство между таблицей и нижней надписью
              flex: 1,
              minWidth: 0,
              border: "1px solid #ddd",
              padding: "10px",
              borderRadius: "8px",
              height: 320,
            }}
          >
            {/* Таблица VR */}
            <table
              style={{ width: "100%", height: "100px", borderCollapse: "collapse" }}
              border="1"
            >
              <thead style={{ backgroundColor: "#f5f5f5" }}>
                <tr>
                  <th>Период</th>
                  <th>Сумма, ₽</th>
                </tr>
              </thead>
              <tbody>
                {dataVrByPeriod
                  ?.filter((row) => row.type === "by_period" && row.id !== 1)
                  .map((row, index) => (
                    <tr
                      key={row.id}
                      style={{
                        backgroundColor: index % 2 === 0 ? "#f9f9f9" : "white",
                      }}
                    >
                      <td>{row.division !== "Всего" ? row.division : null}</td>
                      <td>
                        {row.totalAmount != null ? row.totalAmount.toLocaleString() : 0}
                      </td>
                    </tr>
                  ))}
                {dataVrByPeriod && (
                  <tr style={{ fontWeight: "bold" }}>
                    <td>Всего</td>
                    <td>
                      {(
                        dataVrByPeriod.find((row) => row.id === 1)?.totalAmount ?? 0
                      ).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Надпись снизу */}
            <div style={{ textAlign: "left", paddingTop: "10px" }}>
              <span>
                Задолженность в сравнении с началом года:
              </span>
              <div style={{ marginTop: "4px" }}>
                {isPositiveDebt && (
                  <span style={{ color: "red", fontWeight: "bold" }}>▲ </span>
                )}
                {isNegativeDebt && (
                  <span style={{ color: "green", fontWeight: "bold" }}>▼ </span>
                )}
                <b>{debt_diff.toFixed(2)}</b>%&nbsp;
                {isPositiveDebt && (
                  <b>(+{Number(debt_diff_sum).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽)</b>
                )}
                {isNegativeDebt && (
                  <b>({Number(debt_diff_sum).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽)</b>
                )}
              </div>     
            </div>
          </div>

          {/* Круговая диаграмма VR */}
          <div style={{ flex: 1, minWidth: 0, border: "1px solid #ddd", padding: "10px", borderRadius: "8px", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataVrByPeriod}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="100%"
                  labelLine={false}
                  label={props => {
                    const { cx, cy, midAngle, innerRadius, outerRadius, name, value } = props;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) / 1.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);

                    const total = dataVrByPeriod.find((row) => row.id === 1)?.totalAmount
                    const percent = ((value / total) * 100).toFixed(2);

                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: 12, fill: "#000", fontWeight: "bold" }}
                      >
                        <tspan x={x} dy="-0.6em">{name}</tspan>
                        <tspan x={x} dy="1.2em">({percent}%)</tspan>
                      </text>
                    );
                  }}
                >
                  {chartDataVrByPeriod.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flex: 1}}>
          {/* Информация по жилым/нежилым */}
          <table style={{ width: "100%", height: "100px", borderCollapse: "collapse" }} border="1" >
            <thead style={{ backgroundColor: "#f5f5f5" }}>
              <tr><th>Тип</th><th>Кол-во ЛС</th><th>Сумма, ₽</th></tr>
            </thead>
            <tbody>
              {dataVrByPeriod
                ?.filter(row => row.type === 'by_living')
                .map((row, index) => (
                  <tr key={row.id} style={{ backgroundColor: index % 2 !== 0 ? "f9f9f9" : "white" }}>
                    <td>{row.division}</td>
                    <td>{row.accountCount.toLocaleString()}</td>
                    <td>{row.totalAmount.toLocaleString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>

          {/* Информация по физическим/юридическим лицам */}
          <table style={{ width: "100%", height: "100px", borderCollapse: "collapse" }} border="1" >
            <thead style={{ backgroundColor: "#f5f5f5" }}>
              <tr><th>Тип</th><th>Кол-во ЛС</th><th>Сумма, ₽</th></tr>
            </thead>
            <tbody>
              {dataVrByPeriod
                ?.filter(row => row.type === 'by_private')
                .map((row, index) => (
                  <tr key={row.id} style={{ backgroundColor: index % 2 !== 0 ? "f9f9f9" : "white" }}>
                    <td>{row.division}</td>
                    <td>{row.accountCount.toLocaleString()}</td>
                    <td>{row.totalAmount.toLocaleString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Оперативная задолженность */}
      <div className="border-main-div" style={{ flexDirection: "column",  minWidth: 0, borderRadius: "8px" }}>
        {/* Фильтры */}
        <div style={{ marginBottom: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: 17, textAlign: "center", margin: "0 0 0 0" }}>
            <b>Оперативная задолженность</b>
          </h3>
          <div style={containerStyle} ref={containerRefOp}>
            <label className="my-label">Отчётная дата:</label>
            <input
              type="text"
              readOnly
              value={formatDate(selectedDateOperational)}
              placeholder="дд.мм.гггг"
              onClick={() => setIsOpenOp((prev) => !prev)}
              style={ commonInputStyle }
            />
            {isOpenOp && (
              <div style={calendarPopupStyle}>
                <div style={calendarPopupStyle} ref={calendarRefOp}>
                  <Calendar
                    onChange={(date) => {
                      setSelectedDateOperational(date);
                      setIsOpenOp(false);
                    }}
                    tileDisabled={({ date }) => {
                        const normalized = new Date(date);
                        normalized.setHours(0, 0, 0, 0); 
                        return !allowedTimeStampsOp.has(normalized.getTime());
                    }}
                    activeStartDate={calendarViewDate}
                    onActiveStartDateChange={({ activeStartDate }) =>
                    setCalendarViewDate(activeStartDate)
                    }
                    minDate={
                      new Date(Math.min(...Array.from(allowedTimeStampsOp)))
                    }
                    maxDate={
                      new Date(Math.max(...Array.from(allowedTimeStampsOp)))
                    }                    
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 10, flex: 1}}>
          <div style={{ flex: 1, minWidth: 0, border: "1px solid #ddd", padding: "10px", borderRadius: "8px", height: 320 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }} border="1">
              <thead style={{ backgroundColor: "#f5f5f5" }}>
                <tr><th>Период</th><th>Сумма, ₽</th></tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: "#f9f9f9" }}><td>До 3-х мес</td><td>{dataDebtOperational.debtOperationalLess3m.toLocaleString()}</td></tr>
                <tr><td>3 - 7 мес</td><td>{dataDebtOperational.debtOperationalBetween3mAnd7m.toLocaleString()}</td></tr>
                <tr style={{ backgroundColor: "#f9f9f9" }}><td>7 мес - 2 года</td><td>{dataDebtOperational.debtOperationalBetween7mAnd2y.toLocaleString()}</td></tr>
                <tr><td>2 - 3 года</td><td>{dataDebtOperational.debtOperationalBetween2yAnd3y.toLocaleString()}</td></tr>
                <tr style={{ backgroundColor: "#f9f9f9" }}><td>Более 3-х лет</td><td>{dataDebtOperational.debtOperationalMore3y.toLocaleString()}</td></tr>
                <tr style={{ fontWeight: "bold" }}><td>Всего</td><td>{dataDebtOperational.debtOperationalTotal.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Круговая диаграмма Оперативной задолженности */}
          <div style={{ flex: 1, minWidth: 0, border: "1px solid #ddd", padding: "10px", borderRadius: "8px", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataDebtOperational}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="100%"
                  labelLine={false}
                  label={props => {
                    const { cx, cy, midAngle, innerRadius, outerRadius, name, value } = props;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) / 1.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);

                    const total = dataDebtOperational.debtOperationalTotal;
                    const percent = ((value / total) * 100).toFixed(2);

                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: 12, fill: "#000", fontWeight: "bold" }}
                      >
                        <tspan x={x} dy="-0.6em">{name}</tspan>
                        <tspan x={x} dy="1.2em">({percent}%)</tspan>
                      </text>
                    );
                  }}
                >
                  {chartDataDebtOperational.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}  