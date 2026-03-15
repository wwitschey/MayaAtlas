type PeriodFilterProps = {
  value: string;
  onChange: (value: string) => void;
};

const PERIOD_OPTIONS = [
  { value: "", label: "All periods" },
  { value: "Late Preclassic", label: "Late Preclassic" },
  { value: "Late Classic", label: "Late Classic" },
  { value: "Terminal Classic", label: "Terminal Classic" },
  { value: "Postclassic", label: "Postclassic" },
];

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div
      style={{
        background: "white",
        padding: 12,
        borderRadius: 12,
        width: 220,
        boxShadow: "0 8px 24px rgba(8, 6, 6, 0.15)",
      }}
    >
      <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>
        Period
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "white",
        }}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}