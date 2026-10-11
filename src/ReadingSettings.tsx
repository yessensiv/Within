import { useState } from "react";

const storageKey = "within-reading-size";
const sizes = [
  { value: "normal", label: "Обычный" },
  { value: "large", label: "Увеличенный" },
  { value: "largest", label: "Крупный" },
] as const;
type ReadingSize = (typeof sizes)[number]["value"];

function readSize(): ReadingSize {
  try {
    const saved = localStorage.getItem(storageKey);
    return sizes.find((size) => size.value === saved)?.value ?? "normal";
  } catch {
    return "normal";
  }
}

export function initializeReadingSize() {
  document.documentElement.dataset.readingSize = readSize();
}

export default function ReadingSettings() {
  const [size, setSize] = useState(readSize);
  const [temporary, setTemporary] = useState(false);

  function choose(value: ReadingSize) {
    setSize(value);
    document.documentElement.dataset.readingSize = value;
    try {
      localStorage.setItem(storageKey, value);
      setTemporary(false);
    } catch {
      setTemporary(true);
    }
  }

  return (
    <section className="settings-card reading-settings">
      <h2>Чтение и письмо</h2>
      <p className="muted">Размер текста в блокноте. Выбор сохраняется на этом устройстве.</p>
      <div className="reading-options" role="group" aria-label="Размер текста">
        {sizes.map((option) => (
          <button key={option.value} type="button" aria-pressed={size === option.value}
            onClick={() => choose(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="reading-sample">
        <span>Пример текста</span>
        <p>Иногда достаточно записать мысль и дать ей немного места.</p>
      </div>
      {temporary && <p role="status" className="notice">Размер изменён. Браузер не разрешил сохранить выбор — после перезагрузки выбери его снова.</p>}
    </section>
  );
}
