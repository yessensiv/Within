import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { authErrorMessage } from "./auth-errors";
import { type NoteVersion } from "./note-history";
import { cachedImageUrl, loadImageUrl, forgetImageUrl } from "./image-cache";
import {
  useBlocker,
  NavLink,
  useLocation,
  useNavigate,
  Routes,
  Route,
  useParams,
} from "react-router-dom";
import {
  Sparkles,
  Target,
  BookOpen,
  Route as PathIcon,
  Settings,
  Plus,
  Search,
  Check,
  ArrowLeft,
  ArrowUpRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Pin,
  Bold,
  Italic,
  Heading,
  List,
  Link as LinkIcon,
  X,
  ImagePlus,
  Download,
  Copy,
  ChevronDown,
  Leaf,
  Plane,
  Music,
  Briefcase,
  Heart,
  Wallet,
  User,
  RotateCcw,
  CircleAlert,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  categories,
  seed,
  stamp,
  today,
  slug,
  filterGoals,
  sortGoals,
  sortNotes,
  type GoalSort,
  completion,
  plain,
  publicData,
  type Goal,
  type Note,
  type Memory,
  type Data,
  type Profile,
} from "./domain";
import { LocalRepository, draftKey, type Repository } from "./repository";
import {
  supabase,
  googleEnabled,
  SupabaseRepository,
  type Session,
} from "./supabase";
import {
  saveNoteSerial,
  registerEditor,
  beforeLeaveNote,
  rememberDraft,
  readDraft,
  clearDraft,
} from "./drafts";
import "./style.css";
import "./polish.css";
import "./diary.css";
import Select from "./Select";
import ReadingSettings from "./ReadingSettings";
const sortOptions = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "title", label: "По названию" },
];
let repository: Repository = supabase
  ? new SupabaseRepository("")
  : new LocalRepository();
function Markdown({ body }: { body: string }) {
  return (
    <ReactMarkdown
      skipHtml
      urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : "")}
      components={{
        img: () => null,
        a: ({ href, children }) =>
          /^(https?:|mailto:)/i.test(href || "") ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
      }}
    >
      {body}
    </ReactMarkdown>
  );
}
function ActionMenu({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target)
      ) {
        if (menu.current) menu.current.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  return (
    <details
      ref={menu}
      className={`action-menu ${className}`}
      onClickCapture={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) {
          if (menu.current) {
            menu.current.open = false;
            menu.current.querySelector("summary")?.focus();
          }
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary aria-label={label}>
        <MoreHorizontal size={20} />
      </summary>
      {children}
    </details>
  );
}

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const labelId = useId();
  useEffect(() => {
    const el = ref.current!;
    const previous = document.activeElement as HTMLElement;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-head">
        <h2 id={labelId}>{title}</h2>
        <button className="icon" aria-label="Закрыть" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="switch-wrap"
      role="switch"
      aria-checked={value}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      <span className={"switch " + (value ? "on" : "")}>
        <span />
      </span>
      {label}
    </button>
  );
}
const categoryIcons: Record<string, React.ElementType> = {
  Путешествия: Plane,
  Карьера: Briefcase,
  Здоровье: Heart,
  Деньги: Wallet,
  Творчество: Music,
  Отношения: Heart,
  Личное: Leaf,
};
function Category({ name }: { name: string }) {
  const Icon = categoryIcons[name] || Leaf;
  return (
    <span
      className={
        "category c-" + categories.indexOf(name as (typeof categories)[number])
      }
    >
      <Icon size={13} />
      {name}
    </span>
  );
}
function ImageView({
  path,
  bucket = "covers",
}: {
  path: string | null;
  bucket?: "covers" | "avatars";
}) {
  const [loadedUrl, setLoadedUrl] = useState("");
  const [image, setImage] = useState(() => ({ path, bucket, url: cachedImageUrl(repository, bucket, path) }));
  const url = image.path === path && image.bucket === bucket ? image.url : cachedImageUrl(repository, bucket, path);
  useEffect(() => {
    let live = true;
    setImage({ path, bucket, url: cachedImageUrl(repository, bucket, path) });
    if (!path) return;
    const get = () =>
      loadImageUrl(repository, bucket, path)
        .then((u) => {
          if (live) setImage({ path, bucket, url: u });
        })
        .catch(() => {});
    void get();
    const timer = setInterval(get, 240000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [path, bucket]);
  return url ? <img src={url} alt="" decoding="async" className={loadedUrl === url ? "soft-image is-loaded" : "soft-image"} onLoad={() => setLoadedUrl(url)} onError={() => {
    if (path) forgetImageUrl(repository, bucket, path);
    setImage({ path, bucket, url: "" });
  }} /> : null;
}
function GoalForm({
  goal,
  note,
  uid,
  save,
  close,
}: {
  goal?: Goal;
  note?: Note;
  uid: string;
  save: (g: Goal, n?: Note) => Promise<void>;
  close: () => void;
}) {
  const [title, setTitle] = useState(goal?.title || note?.title || "");
  const [description, setDescription] = useState(
    goal?.description || plain(note?.body || ""),
  );
  const [category, setCategory] = useState(goal?.category || "Личное");
  const [cover, setCover] = useState(goal?.cover_path || null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={goal ? "Редактировать цель" : "Добавить цель"} close={close}>
      <form
        className="goal-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const now = stamp();
            await save(
              {
                ...goal,
                id: goal?.id || crypto.randomUUID(),
                user_id: uid,
                title: title.trim(),
                description,
                category,
                cover_path: cover,
                completed_on: goal?.completed_on || null,
                is_public: goal?.is_public || false,
                deleted_at: null,
                created_at: goal?.created_at || now,
                updated_at: now,
              },
              note,
            );
            close();
          } catch {
            setError("Не удалось сохранить цель. Попробуйте ещё раз.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Название
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Что хочется осуществить?"
          />
        </label>
        <label>
          Описание <span className="muted">· необязательно</span>
          <textarea
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Почему это важно для тебя?"
          />
        </label>
        <label>
          Категория
          <Select
            label="Категория"
            value={category}
            onChange={(value) => setCategory(value as Goal["category"])}
            options={categories.map((value) => ({ value, label: value }))}
          />
        </label>
        <label className="upload">
          <ImagePlus size={18} />{" "}
          {cover ? "Изменить изображение" : "Добавить изображение"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              if (!e.target.files?.[0]) return;
              setBusy(true);
              try {
                setCover(await repository.image("covers", e.target.files[0]));
                setError("");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {cover && (
          <button
            type="button"
            className="text-button"
            onClick={() => setCover(null)}
          >
            Убрать изображение
          </button>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={close}>
            Отмена
          </button>
          <button className="primary" disabled={busy || !title.trim()}>
            {busy ? "Сохранение…" : "Сохранить цель"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function App() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ goal?: Goal; note?: Note } | null>(null);
  const [confirm, setConfirm] = useState<{
    table: "goals" | "notes";
    id: string;
    permanent?: boolean;
  } | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    action?: () => void;
    label?: string;
    memory?: Goal;
  } | null>(null);
  const [memory, setMemory] = useState<Goal | null>(null);
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Все");
  const [category, setCategory] = useState("Все категории");
  const [sortOrder, setSortOrder] = useState<GoalSort>("newest");
  const [selected, setSelected] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.split("/")[1] || "goals";
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = contentRef.current?.animate(
      [{ opacity: 0.35 }, { opacity: 1 }],
      { duration: 260, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    return () => animation?.cancel();
  }, [section, !!data]);
  useEffect(() => {
    if (window.innerWidth < 1050) window.scrollTo(0, 0);
  }, [location.pathname]);
  const ref = useRef(data);
  ref.current = data;
  const notify = useCallback(
    (text: string, action?: () => void, label = "Отменить") =>
      setToast({ text, action, label }),
    [],
  );
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const load = useCallback(async () => {
    try {
      await repository.purge();
      setData(await repository.load());
      setError("");
    } catch {
      setError("Не удалось загрузить данные. Проверьте соединение.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty(
        "--visible-height",
        `${viewport?.height || window.innerHeight}px`,
      );
      document.documentElement.classList.toggle(
        "keyboard-open",
        !!viewport && window.innerHeight - viewport.height > 150,
      );
    };
    update();
    viewport?.addEventListener("resize", update);
    return () => viewport?.removeEventListener("resize", update);
  }, []);
  async function put(
    table: "goals" | "notes" | "memories" | "profiles",
    row: Goal | Note | Memory | Profile,
  ) {
    await repository.put(table, row);
    setData((d) => {
      if (!d) return d;
      if (table === "profiles") return { ...d, profile: row as Profile };
      const rows = d[table] as (Goal | Note | Memory)[];
      return {
        ...d,
        [table]: rows.some((r) => r.id === row.id)
          ? rows.map((r) => (r.id === row.id ? row : r))
          : [row, ...rows],
      };
    });
  }
  async function toggle(g: Goal) {
    try {
      const changed = completion(g, g.completed_on ? null : today());
      await put("goals", changed);
      notify(
        changed.completed_on
          ? "Цель выполнена"
          : "Цель возвращена в невыполненные",
        () => {
          void put("goals", { ...g, updated_at: stamp() }).catch(() =>
            notify("Не удалось отменить. Попробуйте ещё раз."),
          );
        },
      );
      if (changed.completed_on)
        setToast((t) => (t ? { ...t, memory: changed } : t));
    } catch {
      notify("Не удалось изменить статус. Попробуйте ещё раз.");
    }
  }
  async function saveGoal(g: Goal, n?: Note) {
    const latest = n && ref.current?.notes.find((r) => r.id === n.id);
    if (latest?.goal_id) {
      navigate("/goals/" + latest.goal_id);
      return;
    }
    if (latest) {
      const id = await repository.convert(latest, g);
      setData(await repository.load());
      setSelected(id);
    } else {
      await put("goals", g);
      setSelected(g.id);
    }
  }
  async function deletion() {
    if (!confirm || !data) return;
    try {
      const { table, id, permanent } = confirm;
      const row = data[table].find((r) => r.id === id)!;
      if (permanent) {
        await repository.remove(table, id);
        setData(await repository.load());
      } else {
        await put(table, { ...row, deleted_at: stamp(), updated_at: stamp() });
        notify(
          table === "goals"
            ? "Цель перемещена в корзину"
            : "Запись перемещена в корзину",
          () => {
            void put(table, {
              ...row,
              deleted_at: null,
              updated_at: stamp(),
            }).catch(() => notify("Не удалось восстановить"));
          },
        );
      }
      if (table === "goals" && selected === id) setSelected("");
      if (location.pathname === `/${table}/${id}`) {
        navigate(`/${table}`, { replace: true });
      }
      setConfirm(null);
    } catch {
      notify("Не удалось удалить. Попробуйте ещё раз.");
    }
  }
  if (!data)
    return (
      <div className="loading">
        <Sparkles />
        <p>{error || "Открываем твоё пространство…"}</p>
        {error && <button onClick={load}>Попробовать снова</button>}
      </div>
    );
  const currentId = location.pathname.split("/")[2] || selected;
  const current = data.goals.find((g) => g.id === currentId && !g.deleted_at);
  const goals = sortGoals(
    filterGoals(data.goals, query, status, category),
    sortOrder,
  );
  const activeGoal = location.pathname.split("/")[2]
    ? current
    : current || goals[0];
  const links = [
    { to: "/goals", text: "Мои цели", mobile: "Цели", icon: Target },
    { to: "/notes", text: "Блокнот", mobile: "Блокнот", icon: BookOpen },
    { to: "/journey", text: "Мой путь", mobile: "Мой путь", icon: PathIcon },
  ];
  function detail(g: Goal) {
    const linked = data!.notes.find((n) => n.goal_id === g.id && !n.deleted_at);
    return (
      <>
        <div className="detail-top">
          <span className={g.completed_on ? "completed" : "muted"}>
            {g.completed_on ? (
              <>
                <Check size={15} />
                Выполнено
              </>
            ) : (
              "Не выполнено"
            )}
          </span>
          <ActionMenu key={g.id} label="Дополнительные действия с целью">
            <button onClick={() => setConfirm({ table: "goals", id: g.id })}>
              <Trash2 size={16} />
              Удалить цель
            </button>
          </ActionMenu>
        </div>
        {g.cover_path && (
          <div className="detail-cover">
            <ImageView path={g.cover_path} />
          </div>
        )}
        <Category name={g.category} />
        <h2>{g.title}</h2>
        <p className="description">
          {g.description ||
            "Здесь можно оставить то, что делает эту цель важной."}
        </p>
        {g.completed_on && (
          <label className="date-label">
            Дата выполнения
            <input
              aria-label="Дата выполнения"
              type="date"
              max={today()}
              value={g.completed_on}
              onChange={(e) => {
                if (e.target.value)
                  try {
                    void put("goals", completion(g, e.target.value)).catch(() =>
                      notify("Не удалось сохранить дату"),
                    );
                  } catch (err) {
                    notify((err as Error).message);
                  }
              }}
            />
          </label>
        )}
        <div className="detail-actions">
          <button
            className={g.completed_on ? "secondary" : "primary"}
            onClick={() => toggle(g)}
          >
            {g.completed_on ? <RotateCcw size={16} /> : <Check size={17} />}{" "}
            {g.completed_on
              ? "Вернуть в невыполненные"
              : "Отметить как выполненное"}
          </button>
          <button className="secondary" onClick={() => setForm({ goal: g })}>
            Редактировать
          </button>
        </div>
        {g.completed_on && (
          <>
            <button className="text-button" onClick={() => setMemory(g)}>
              <BookOpen size={16} />{" "}
              {data!.memories.some((m) => m.goal_id === g.id)
                ? "Открыть воспоминание"
                : "Сохранить воспоминание"}
            </button>
            <Toggle
              label="Показывать в публичном профиле"
              value={g.is_public}
              onChange={() =>
                void put("goals", {
                  ...g,
                  is_public: !g.is_public,
                  updated_at: stamp(),
                }).catch(() => notify("Не удалось сохранить"))
              }
            />
          </>
        )}
        {linked && (
          <button
            className="text-button"
            onClick={() => navigate("/notes/" + linked.id)}
          >
            Открыть запись <ArrowUpRight size={15} />
          </button>
        )}
        <div className="detail-foot">
          <Leaf size={15} />
          <span>В своём темпе. Когда будешь готова.</span>
        </div>
      </>
    );
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink to="/goals" className="brand">
          <Constellation />
          <span>
            Within<small>Личное пространство</small>
          </span>
        </NavLink>
        <div className="space-note">
          <Sparkles size={22} />
          <p>
            Пространство
            <br />
            для важного
          </p>
          <small>
            Мысли, желания и то,
            <br />
            что хочется сохранить.
          </small>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to}>
              <l.icon size={20} />
              {l.text}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          {repository.demo && (
            <span className="demo">
              <span />
              Демонстрационный режим
            </span>
          )}
          <NavLink to="/settings" className="user">
            <span className="avatar">
              {data.profile.avatar_path ? (
                <ImageView path={data.profile.avatar_path} bucket="avatars" />
              ) : (
                data.profile.display_name.slice(0, 1)
              )}
            </span>
            <span>
              {data.profile.display_name}
              <small>Настройки</small>
            </span>
            <Settings size={18} />
          </NavLink>
        </div>
      </aside>
      <header className="mobile-header">
        <div>
          <NavLink to="/goals" className="brand">
            <Constellation />
            Within
          </NavLink>
          {repository.demo && (
            <small className="mobile-demo">Демонстрационный режим</small>
          )}
        </div>
        <NavLink to="/settings" className="avatar" aria-label="Настройки">
          {data.profile.display_name.slice(0, 1)}
        </NavLink>
      </header>
      <main ref={contentRef}>
        {section === "goals" && (
          <>
            <div className="page-head">
              <div>
                <span className="eyebrow">Моё пространство</span>
                <h1>Мои цели</h1>
                <p>То, что я хочу осуществить</p>
              </div>
              <button className="primary" onClick={() => setForm({})}>
                <Plus size={18} />
                Добавить цель
              </button>
            </div>
            <div className="goal-layout">
              <section
                className={
                  "goal-list " +
                  (location.pathname.split("/")[2] ? "mobile-hidden" : "")
                }
              >
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Поиск целей"
                    placeholder="Найти то, что важно…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Очистить поиск"
                      className="icon"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="filters">
                  <div className="tabs">
                    {["Все", "Не выполнено", "Выполнено"].map((s) => (
                      <button
                        key={s}
                        className={s === status ? "active" : ""}
                        onClick={() => setStatus(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="filter-controls">
                    <Select
                      label="Категория цели"
                      value={category}
                      onChange={setCategory}
                      options={["Все категории", ...categories].map(
                        (value) => ({ value, label: value }),
                      )}
                    />
                    <Select
                      label="Сортировка целей"
                      value={sortOrder}
                      onChange={(value) => setSortOrder(value as GoalSort)}
                      options={sortOptions}
                    />
                  </div>
                </div>
                <div className="cards">
                  {goals.map((g) => (
                    <article
                      key={g.id}
                      className={
                        "goal-card " +
                        (g.id === activeGoal?.id ? "selected" : "")
                      }
                    >
                      <button
                        className="card-content"
                        onClick={() => {
                          setSelected(g.id);
                          navigate("/goals/" + g.id);
                        }}
                      >
                        {g.cover_path && (
                          <div className="card-cover">
                            <ImageView path={g.cover_path} />
                          </div>
                        )}
                        <div className="card-top">
                          <Category name={g.category} />
                          <ArrowUpRight size={17} />
                        </div>
                        <h3>{g.title}</h3>
                        {g.description && <p>{g.description}</p>}
                      </button>
                      <div className="card-footer">
                        <Toggle
                          value={!!g.completed_on}
                          onChange={() => toggle(g)}
                          label="Выполнено"
                        />
                        {g.completed_on && (
                          <span className="completion-date">
                            <Check size={13} />
                            {new Date(
                              g.completed_on + "T12:00:00",
                            ).toLocaleDateString("ru", {
                              day: "numeric",
                              month: "long",
                            })}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!goals.length && (
                  <Empty
                    icon={Target}
                    text={
                      data.goals.some((g) => !g.deleted_at)
                        ? "Ничего не найдено. Попробуй изменить поиск."
                        : "Добавь то, что хочешь осуществить"
                    }
                  />
                )}
                <p className="quiet">
                  <Leaf size={14} />
                  Здесь нет спешки. Только то, что важно тебе.
                </p>
              </section>
              <aside
                className={
                  "detail " +
                  (!location.pathname.split("/")[2] ? "mobile-hidden" : "")
                }
              >
                <button
                  className="mobile-back text-button"
                  onClick={() => navigate("/goals")}
                >
                  <ArrowLeft size={18} />
                  Назад
                </button>
                <div className="panel-label">Выбранная цель</div>
                {activeGoal ? (
                  detail(activeGoal)
                ) : (
                  <Empty
                    icon={Target}
                    text="Выбери цель, чтобы вернуться к ней"
                  />
                )}
              </aside>
            </div>
          </>
        )}
        {section === "notes" && (
          <Notes
            data={data}
            saved={(n) =>
              setData((d) =>
                d
                  ? {
                      ...d,
                      notes: d.notes.map((r) =>
                        r.id === n.id
                          ? {
                              ...r,
                              title: n.title,
                              body: n.body,
                              updated_at: n.updated_at,
                            }
                          : r,
                      ),
                    }
                  : d,
              )
            }
            put={put}
            remove={(id) => setConfirm({ table: "notes", id })}
            convert={(note) => setForm({ note })}
            notify={notify}
          />
        )}
        {section === "journey" && (
          <Journey data={data} save={(m) => put("memories", m)} />
        )}
        {section === "settings" && (
          <>
            <div className="page-head">
              <div>
                <h1>Настройки</h1>
                <p>Твоё личное пространство</p>
              </div>
            </div>
            <div className="settings-layout">
              <ReadingSettings />
              <section className="settings-card">
                <h2>О тебе</h2>
                <ProfileForm
                  profile={data.profile}
                  put={(p) => put("profiles", p)}
                  notify={notify}
                />
                {repository.demo ? (
                  <p className="notice">
                    Демонстрационный режим. Вход, email и смена пароля доступны
                    после подключения аккаунтов. Данные сохраняются в этом
                    браузере.
                  </p>
                ) : (
                  <AccountSettings notify={notify} />
                )}
              </section>
              <section className="settings-card">
                <h2>Публичный профиль</h2>
                <p className="muted">
                  Ты решаешь, чем поделиться. Блокнот всегда остаётся личным.
                </p>
                <Toggle
                  label="Публичный профиль"
                  value={data.profile.is_public}
                  onChange={() => {
                    if (data.profile.is_public)
                      void put("profiles", {
                        ...data.profile,
                        is_public: false,
                        updated_at: stamp(),
                      }).catch(() => notify("Не удалось выключить профиль"));
                    else setPreview(true);
                  }}
                />
                {data.profile.is_public && (
                  <div className="share-link">
                    <input
                      readOnly
                      aria-label="Ссылка на профиль"
                      value={`${locationOrigin()}/u/${data.profile.public_slug}`}
                    />
                    <button
                      className="icon"
                      aria-label="Скопировать"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(
                            `${locationOrigin()}/u/${data.profile.public_slug}`,
                          )
                          .then(() => notify("Ссылка скопирована"))
                          .catch(() => notify("Скопируйте ссылку из поля"))
                      }
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                )}
                {repository.demo && (
                  <p className="notice">
                    В демо-режиме ссылка доступна только в этом браузере. Для
                    публикации нужен Supabase.
                  </p>
                )}
              </section>
              <section className="settings-card">
                <h2>Мои данные</h2>
                <button
                  className="secondary"
                  onClick={() => {
                    const blob = new Blob(
                      [
                        JSON.stringify(
                          {
                            goals: data.goals.filter((g) => !g.deleted_at),
                            notes: data.notes.filter((n) => !n.deleted_at),
                            memories: data.memories.filter((m) =>
                              data.goals.some(
                                (g) => g.id === m.goal_id && !g.deleted_at,
                              ),
                            ),
                          },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `мой-мир-${today()}.json`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <Download size={17} />
                  Экспорт моих данных
                </button>
                <button
                  className="text-button"
                  onClick={() => navigate("/trash")}
                >
                  <Trash2 size={17} />
                  Корзина
                </button>
              </section>
            </div>
          </>
        )}
        {section === "trash" && (
          <>
            <button
              className="text-button"
              onClick={() => navigate("/settings")}
            >
              <ArrowLeft size={18} />
              Настройки
            </button>
            <div className="page-head">
              <div>
                <h1>Корзина</h1>
                <p>Можно восстановить в течение 30 дней</p>
              </div>
            </div>
            {(["goals", "notes"] as const).flatMap((table) =>
              data[table]
                .filter((r) => r.deleted_at)
                .map((row) => (
                  <div className="trash-row" key={row.id}>
                    <div>
                      <h3>{row.title || "Без названия"}</h3>
                      <span className="muted">
                        {table === "goals" ? "Цель" : "Запись"}
                      </span>
                    </div>
                    <button
                      className="secondary"
                      onClick={() =>
                        void put(table, {
                          ...row,
                          deleted_at: null,
                          updated_at: stamp(),
                        }).catch(() => notify("Не удалось восстановить"))
                      }
                    >
                      Восстановить
                    </button>
                    <button
                      className="icon"
                      aria-label="Удалить навсегда"
                      onClick={() =>
                        setConfirm({ table, id: row.id, permanent: true })
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )),
            )}
            {!data.goals.some((g) => g.deleted_at) &&
              !data.notes.some((n) => n.deleted_at) && (
                <Empty icon={Trash2} text="В корзине пока ничего нет" />
              )}
          </>
        )}
      </main>
      <nav className="bottom-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to}>
            <l.icon size={21} />
            <span>{l.mobile}</span>
          </NavLink>
        ))}
      </nav>
      {form && (
        <GoalForm
          {...form}
          uid={data.profile.id}
          save={saveGoal}
          close={() => setForm(null)}
        />
      )}{" "}
      {confirm && (
        <Modal
          title={
            confirm.permanent ? "Удалить навсегда?" : "Переместить в корзину?"
          }
          close={() => setConfirm(null)}
        >
          <p className="muted">
            {confirm.permanent
              ? confirm.table === "goals"
                ? "Восстановить цель после удаления не получится. Связанное воспоминание тоже будет удалено."
                : "Восстановить запись после удаления не получится."
              : "Ты сможешь восстановить это в настройках в течение 30 дней."}
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setConfirm(null)}>
              Отмена
            </button>
            <button className="danger" onClick={deletion}>
              Удалить
            </button>
          </div>
        </Modal>
      )}
      {memory && (
        <MemoryEditor
          goal={memory}
          existing={data.memories.find((m) => m.goal_id === memory.id)}
          save={(m) => put("memories", m)}
          close={() => setMemory(null)}
        />
      )}{" "}
      {preview && (
        <Modal title="Вот что увидят другие" close={() => setPreview(false)}>
          <PublicContent
            result={{
              ...publicData({
                ...data,
                profile: { ...data.profile, is_public: true },
              }),
            }}
          />
          <p className="notice">
            Будут видны только выбранные выполненные цели и отдельно разрешённые
            воспоминания.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setPreview(false)}>
              Отмена
            </button>
            <button
              className="primary"
              onClick={async () => {
                try {
                  await put("profiles", {
                    ...data.profile,
                    is_public: true,
                    public_slug: slug(data.profile.public_slug),
                    updated_at: stamp(),
                  });
                  setPreview(false);
                } catch {
                  notify("Не удалось включить профиль");
                }
              }}
            >
              Подтвердить
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <div className="toast-message">
            {toast.text.startsWith("Не удалось") ? <CircleAlert size={18} aria-hidden="true" style={{color:"#f29aab"}} /> : <Check size={18} aria-hidden="true" />}
            <span>{toast.text}</span>
          </div>
          {(toast.memory || toast.action) && (
            <div className="toast-actions">
              {toast.memory && (
                <button
                  onClick={() => {
                    setMemory(toast.memory!);
                    setToast(null);
                  }}
                >
                  Сохранить воспоминание
                </button>
              )}
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.();
                    setToast(null);
                  }}
                >
                  {toast.label}
                </button>
              )}
            </div>
          )}
          <button
            className="icon"
            aria-label="Закрыть уведомление"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Constellation() {
  return (
    <svg
      className="constellation"
      width="38"
      height="38"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 25L16 8L31 15L25 32L7 25L31 15M16 8L25 32"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".6"
      />
      {[
        [7, 25],
        [16, 8],
        [31, 15],
        [25, 32],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 1 ? 3 : 2} fill="currentColor" />
      ))}
    </svg>
  );
}
function Empty({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="empty">
      <Icon size={30} />
      <p>{text}</p>
    </div>
  );
}
function locationOrigin() {
  return window.location.origin;
}
function Notes({
  data,
  put,
  remove,
  convert,
  notify,
  saved,
}: {
  data: Data;
  saved: (n: Note) => void;
  put: (t: "notes", n: Note) => Promise<void>;
  remove: (id: string) => void;
  convert: (n: Note) => void;
  notify: (s: string) => void;
}) {
  const nav = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [pinned, setPinned] = useState(false);
  const [sortOrder, setSortOrder] = useState<GoalSort>("newest");
  const [selection, setSelection] = useState("");
  const notes = sortNotes(
    data.notes.filter(
      (n) =>
        !n.deleted_at &&
        (!pinned || n.pinned) &&
        `${n.title} ${n.body}`
          .toLocaleLowerCase("ru")
          .includes(q.toLocaleLowerCase("ru")),
    ),
    sortOrder,
  );
  const id = location.pathname.split("/")[2] || selection;
  const selected =
    data.notes.find((n) => n.id === id && !n.deleted_at) || notes[0];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Блокнот</h1>
          <p>Место для мыслей. Просто пиши.</p>
        </div>
        <button
          className="primary"
          onClick={async () => {
            if (!(await beforeLeaveNote())) return;
            const now = stamp();
            const n: Note = {
              id: crypto.randomUUID(),
              user_id: data.profile.id,
              title: "Новая запись",
              body: "",
              pinned: false,
              goal_id: null,
              deleted_at: null,
              created_at: now,
              updated_at: now,
            };
            try {
              await put("notes", n);
              setSelection(n.id);
              nav("/notes/" + n.id);
            } catch {
              notify("Не удалось создать запись");
            }
          }}
        >
          <Plus size={18} />
          Новая запись
        </button>
      </div>
      <div className="notebook">
        <section
          className={
            "note-list " +
            (location.pathname.split("/")[2] ? "mobile-hidden" : "")
          }
        >
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Поиск записей"
              placeholder="Поиск по записям"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="tabs">
            {["Все", "Закреплённые"].map((s, i) => (
              <button
                key={s}
                className={pinned === !!i ? "active" : ""}
                onClick={() => setPinned(!!i)}
              >
                {s}
              </button>
            ))}
          </div>
          <Select
            className="note-sort"
            label="Сортировка записей"
            value={sortOrder}
            onChange={(value) => setSortOrder(value as GoalSort)}
            options={sortOptions}
          />
          <div className="note-items">
            {notes.map((n) => (
              <button
                key={n.id}
                className={
                  "note-item " + (selected?.id === n.id ? "selected" : "")
                }
                onClick={async () => {
                  if (!(await beforeLeaveNote())) return;
                  setSelection(n.id);
                  nav("/notes/" + n.id);
                }}
              >
                <div>
                  <h3>{n.title || "Без названия"}</h3>
                  {n.pinned && <Pin size={15} />}
                </div>
                <p>{plain(n.body) || "Можно просто начать писать…"}</p>
                <small>
                  {new Date(n.updated_at).toLocaleDateString("ru", {
                    day: "numeric",
                    month: "long",
                  })}
                </small>
              </button>
            ))}
            {!notes.length && (
              <Empty
                icon={BookOpen}
                text={
                  q ? "Ничего не найдено" : "Здесь можно просто начать писать"
                }
              />
            )}
          </div>
        </section>
        <section
          className={
            "editor-panel " +
            (!location.pathname.split("/")[2] ? "mobile-hidden" : "")
          }
        >
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              saved={saved}
              put={put}
              remove={remove}
              convert={convert}
            />
          ) : (
            <Empty icon={BookOpen} text="Здесь можно просто начать писать" />
          )}
        </section>
      </div>
    </>
  );
}
function NoteEditor({
  note,
  put,
  remove,
  convert,
  saved,
}: {
  note: Note;
  saved: (n: Note) => void;
  put: (t: "notes", n: Note) => Promise<void>;
  remove: (id: string) => void;
  convert: (n: Note) => void;
}) {
  const nav = useNavigate();
  const [draft, setDraft] = useState<Note>(() => {
    try {
      const raw = readDraft(draftKey(note.user_id, note.id));
      return raw ? { ...note, ...raw, goal_id: note.goal_id } : note;
    } catch {
      return note;
    }
  });
  const [state, setState] = useState("Сохранено");
  const [view, setView] = useState(false);
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<NoteVersion[] | null>(null);
  const [version, setVersion] = useState<NoteVersion | null>(null);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    if (!focused) return;
    document.body.classList.add("writing-focus");
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setFocused(false); };
    window.addEventListener("keydown", escape);
    return () => { document.body.classList.remove("writing-focus"); window.removeEventListener("keydown", escape); };
  }, [focused]);
  const area = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(draft);
  const persisted = useRef(JSON.stringify(note));
  const inFlight = useRef<Promise<void> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const mounted = useRef(true);
  const failed = useRef(false);
  latest.current = { ...draft, goal_id: note.goal_id, pinned: note.pinned };
  const save = useCallback(async () => {
    if (inFlight.current) {
      await inFlight.current;
      return saveRef.current();
    }
    const snapshot = latest.current;
    if (JSON.stringify(snapshot) === persisted.current) return;
    const task = (async () => {
      if (mounted.current) setState("Сохранение…");
      try {
        await saveNoteSerial(snapshot, async (n) => {
          await repository.saveNote(n);
          saved(n);
        });
        persisted.current = JSON.stringify(snapshot);
        failed.current = false;
        if (JSON.stringify(latest.current) === persisted.current) {
          clearDraft(draftKey(note.user_id, note.id));
          if (mounted.current) setState("Сохранено");
        }
      } catch {
        failed.current = true;
        if (mounted.current) setState("Не удалось сохранить");
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = task;
    await task;
    if (!failed.current && JSON.stringify(latest.current) !== persisted.current)
      await saveRef.current();
  }, [note.id, note.user_id, put]);
  saveRef.current = save;
  const blocker = useBlocker(
    () => JSON.stringify(latest.current) !== persisted.current,
  );
  useEffect(
    () =>
      registerEditor(async () => {
        await saveRef.current();
        return !failed.current;
      }),
    [],
  );
  useEffect(() => {
    if (blocker.state === "blocked") {
      void beforeLeaveNote().then((ok) => {
        if (ok) blocker.proceed();
        else blocker.reset();
      });
    }
  }, [blocker]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void saveRef.current();
    };
  }, []);
  useEffect(() => {
    const current = JSON.stringify(latest.current);
    if (current === persisted.current) return;
    try {
      rememberDraft(draftKey(note.user_id, note.id), latest.current);
    } catch {
      setState("Не удалось сохранить");
    }
    setState("Сохранение…");
    const timer = setTimeout(() => void saveRef.current(), 800);
    return () => clearTimeout(timer);
  }, [draft, note.id, note.user_id]);
  useEffect(() => {
    const retry = setInterval(() => {
      if (failed.current) void saveRef.current();
    }, 5000);
    const unload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== persisted.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const online = () => void saveRef.current();
    window.addEventListener("beforeunload", unload);
    window.addEventListener("online", online);
    return () => {
      clearInterval(retry);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", online);
    };
  }, []);
  function change(p: Partial<Note>) {
    setDraft((d) => ({ ...d, ...p, updated_at: stamp() }));
  }
  function format(before: string, after = "") {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    change({
      body:
        draft.body.slice(0, start) +
        before +
        draft.body.slice(start, end) +
        after +
        draft.body.slice(end),
    });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }
  return (
    <>
      <button className="mobile-back text-button" onClick={() => nav("/notes")}>
        <ArrowLeft size={18} />
        Назад
      </button>
      <div className="writing-actions">
        <button className="secondary" aria-pressed={focused} onClick={() => setFocused(v => !v)}>{focused ? "Вернуться" : "Сосредоточиться"}</button>
        <button className="text-button" onClick={async () => { await saveRef.current(); if (failed.current) return; try { setHistory(await repository.history(note.user_id, note.id)); setVersion(null); setHistoryError(""); } catch { setHistoryError("Не удалось загрузить историю. Проверь соединение и попробуй снова."); } }}>История изменений</button>
      </div>
      {historyError && <p role="alert" className="error">{historyError}</p>}
      {history && <Modal title="История изменений" close={() => { setHistory(null); setVersion(null); }}>
        <p className="muted">{repository.demo ? "Предыдущие версии хранятся в этом браузере." : "Предыдущие версии сохраняются в аккаунте и доступны на других устройствах."} Сохраняются последние 100 изменений.</p>
        {!history.length && <p>Здесь появятся предыдущие версии после изменения текста.</p>}
        <div className="version-list">{history.map(v => <button className={version?.id === v.id ? "version-item selected" : "version-item"} key={v.id} onClick={() => setVersion(v)}>
          <strong>{v.title || "Без названия"}</strong><small>{new Date(v.saved_at).toLocaleString("ru")}</small>
        </button>)}</div>
        {version && <div className="version-preview"><h3>{version.title || "Без названия"}</h3><Markdown body={version.body} /><button className="primary" onClick={() => { change({title: version.title, body: version.body}); setView(false); setHistory(null); setVersion(null); }}>Восстановить эту версию</button></div>}
      </Modal>}
      <div className="editor-meta">
        <span>
          {new Date(note.created_at).toLocaleDateString("ru", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        <ActionMenu
          key={note.id}
          label="Действия с записью"
          className="note-menu"
        >
          <div className="menu-items">
            <button
              className={"icon " + (note.pinned ? "accent" : "")}
              aria-label={note.pinned ? "Открепить" : "Закрепить"}
              onClick={async () => {
                await saveRef.current();
                if (failed.current) return;
                try {
                  await put("notes", {
                    ...latest.current,
                    pinned: !note.pinned,
                    updated_at: stamp(),
                  });
                } catch {
                  setState("Не удалось сохранить");
                }
              }}
            >
              <Pin size={17} />
              {note.pinned ? "Открепить" : "Закрепить"}
            </button>
            <button
              className="icon"
              aria-label="Удалить запись"
              onClick={() => remove(note.id)}
            >
              <Trash2 size={17} />
              Удалить запись
            </button>
          </div>
        </ActionMenu>
      </div>
      <input
        className="note-title"
        aria-label="Название записи"
        value={draft.title}
        onChange={(e) => change({ title: e.target.value })}
      />
      <div className="formatting">
        {[
          { icon: Bold, label: "Жирный", before: "**", after: "**" },
          { icon: Italic, label: "Курсив", before: "*", after: "*" },
          { icon: Heading, label: "Заголовок", before: "\n## " },
          { icon: List, label: "Маркированный список", before: "\n- " },
          {
            icon: LinkIcon,
            label: "Ссылка",
            before: "[",
            after: "](https://)",
          },
        ].map((f) => (
          <button
            key={f.label}
            className="icon"
            aria-label={f.label}
            disabled={view}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => format(f.before, f.after)}
          >
            <f.icon size={17} />
          </button>
        ))}
        <button
          className="text-button preview-toggle"
          aria-label={view ? "Редактировать" : "Предпросмотр"}
          title={view ? "Редактировать" : "Предпросмотр"}
          aria-pressed={view}
          onClick={() => setView((v) => !v)}
        >
          {view ? <Pencil size={17} /> : <Eye size={17} />}
          <span className="preview-label">
            {view ? "Редактировать" : "Предпросмотр"}
          </span>
        </button>
      </div>
      {view ? (
        <div className="markdown note-body">
          <Markdown body={draft.body} />
        </div>
      ) : (
        <textarea
          ref={area}
          className="note-body"
          aria-label="Текст записи Markdown"
          spellCheck lang="ru"
          placeholder="О чём ты думаешь?"
          value={draft.body}
          onChange={(e) => change({ body: e.target.value })}
        />
      )}
      <div className="editor-footer">
        <span
          role="status"
          className={state === "Не удалось сохранить" ? "error" : "muted"}
        >
          {state === "Сохранено" && <Check size={14} />} {state}
        </span>
        {state === "Не удалось сохранить" && (
          <button
            className="text-button"
            onClick={() => void saveRef.current()}
          >
            Повторить
          </button>
        )}
        <button
          className="secondary"
          onClick={async () => {
            await saveRef.current();
            if (failed.current) return;
            if (note.goal_id) nav("/goals/" + note.goal_id);
            else convert(latest.current);
          }}
        >
          {note.goal_id ? "Открыть связанную цель" : "Превратить в цель"}
          <ArrowUpRight size={15} />
        </button>
      </div>
    </>
  );
}
function Journey({
  data,
  save,
}: {
  data: Data;
  save: (m: Memory) => Promise<void>;
}) {
  const [year, setYear] = useState("Все годы");
  const [selection, setSelection] = useState("");
  const nav = useNavigate();
  const location = useLocation();
  const routeId = location.pathname.split("/")[2];
  const completed = data.goals
    .filter((g) => !g.deleted_at && g.completed_on)
    .sort((a, b) => b.completed_on!.localeCompare(a.completed_on!));
  const filtered = completed.filter(
    (g) => year === "Все годы" || g.completed_on?.startsWith(year),
  );
  const chosen = completed.find((g) => g.id === (routeId || selection));
  let previous = "";
  return (
    <>
      <div className="page-head diary-heading">
        <div>
          <h1>Мой путь</h1>
          <p>То, что уже получилось</p>
        </div>
        <Select
          label="Год"
          value={year}
          onChange={setYear}
          options={[
            "Все годы",
            ...new Set(completed.map((g) => g.completed_on!.slice(0, 4))),
          ].map((value) => ({ value, label: value }))}
        />
      </div>
      <div
        className={
          "journey-layout journey-album " + (chosen ? "has-memory" : "")
        }
      >
        <div className={"journey " + (routeId ? "mobile-hidden" : "")}>
          {filtered.map((g) => {
            const month = new Date(
              g.completed_on! + "T12:00:00",
            ).toLocaleDateString("ru", { month: "long", year: "numeric" });
            const heading = previous !== month;
            previous = month;
            const m = data.memories.find((m) => m.goal_id === g.id);
            return (
              <React.Fragment key={g.id}>
                {heading && (
                  <h2 className="month">
                    <span>
                      {new Date(
                        g.completed_on! + "T12:00:00",
                      ).toLocaleDateString("ru", { month: "long" })}
                    </span>
                    <small>{g.completed_on!.slice(0, 4)}</small>
                  </h2>
                )}
                <article
                  className={
                    "journey-row " + (chosen?.id === g.id ? "is-selected" : "")
                  }
                >
                  <time className="journey-date" dateTime={g.completed_on!}>
                    <strong>{g.completed_on!.slice(8)}</strong>
                    <span>
                      {new Date(g.completed_on! + "T12:00:00")
                        .toLocaleDateString("ru", {
                          day: "numeric",
                          month: "long",
                        })
                        .split(" ")
                        .slice(1)
                        .join(" ")}
                    </span>
                  </time>
                  <div className="timeline-mark">
                    <Check size={12} />
                  </div>
                  <div
                    className={
                      "journey-content " + (g.cover_path ? "with-cover" : "")
                    }
                  >
                    {g.cover_path && (
                      <div className="journey-cover">
                        <ImageView path={g.cover_path} />
                      </div>
                    )}
                    <div className="journey-card-text">
                      <div className="journey-card-top">
                        <Category name={g.category} />
                      </div>
                      <h2>
                        <button
                          className="journey-title-button"
                          onClick={() => {
                            setSelection(g.id);
                            nav("/journey/" + g.id);
                          }}
                        >
                          {g.title}
                        </button>
                      </h2>
                      {m?.body && (
                        <p className="journey-excerpt">«{plain(m.body)}»</p>
                      )}
                      <button
                        className="text-button journey-memory-link"
                        onClick={() => {
                          setSelection(g.id);
                          nav("/journey/" + g.id);
                        }}
                      >
                        {m ? <BookOpen size={15} /> : <Plus size={15} />}
                        {m ? "Открыть воспоминание" : "Добавить воспоминание"}
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              </React.Fragment>
            );
          })}
          {!filtered.length && (
            <Empty
              icon={PathIcon}
              text="Здесь появятся цели, которые ты отметишь выполненными"
            />
          )}
        </div>
        {chosen && (
          <div className={!routeId ? "mobile-hidden" : ""}>
            <MemoryEditor
              key={chosen.id}
              inline
              goal={chosen}
              existing={data.memories.find((m) => m.goal_id === chosen.id)}
              save={save}
              close={() => {
                setSelection("");
                if (routeId) nav("/journey");
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
function MemoryFrame({
  inline,
  title,
  children,
  close,
}: {
  inline?: boolean;
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  return inline ? (
    <section className="memory-panel">
      <button className="mobile-back text-button" onClick={close}>
        <ArrowLeft size={18} />
        Назад
      </button>
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="icon"
          aria-label="Закрыть воспоминание"
          onClick={close}
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </section>
  ) : (
    <Modal title={title} close={close}>
      {children}
    </Modal>
  );
}
function MemoryEditor({
  goal,
  existing,
  save,
  close,
  inline,
}: {
  inline?: boolean;
  goal: Goal;
  existing?: Memory;
  save: (m: Memory) => Promise<void>;
  close: () => void;
}) {
  const [body, setBody] = useState(existing?.body || "");
  const [isPublic, setPublic] = useState(existing?.is_public || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(!existing);
  return (
    <MemoryFrame inline={inline} title="Воспоминание" close={close}>
      {goal.cover_path && <div className="memory-cover"><ImageView path={goal.cover_path} /></div>}
      <Category name={goal.category} />
      <h2 className="memory-title">{goal.title}</h2>
      <p className="muted">
        {new Date(goal.completed_on! + "T12:00:00").toLocaleDateString("ru", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
      {!editing ? (
        <div className="memory-reading">
          <div className="memory-prose"><Markdown body={body} /></div>
          <button className="secondary" onClick={() => setEditing(true)}><Pencil size={16} />Редактировать</button>
        </div>
      ) : <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const now = stamp();
            await save({
              id: existing?.id || crypto.randomUUID(),
              user_id: goal.user_id,
              goal_id: goal.id,
              body,
              is_public: isPublic,
              created_at: existing?.created_at || now,
              updated_at: now,
            });
            close();
          } catch {
            setError("Не удалось сохранить воспоминание");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Что хочется запомнить?
          <textarea
            autoFocus
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Как это было? Что ты почувствовала?"
          />
        </label>
        <Toggle
          value={isPublic}
          label="Показать воспоминание"
          onChange={() => setPublic((v) => !v)}
        />
        <p className="notice">
          Появится в публичном профиле, только если профиль и эта цель
          опубликованы.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={close}>
            {existing ? "Закрыть" : "Позже"}
          </button>
          <button disabled={busy} className="primary">
            {busy ? "Сохранение…" : "Сохранить воспоминание"}
          </button>
        </div>
      </form>}
    </MemoryFrame>
  );
}
function ProfileForm({
  profile,
  put,
  notify,
}: {
  profile: Profile;
  put: (p: Profile) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [name, setName] = useState(profile.display_name);
  const [avatar, setAvatar] = useState(profile.avatar_path);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await put({
            ...profile,
            display_name: name.trim(),
            avatar_path: avatar,
            updated_at: stamp(),
          });
          notify("Профиль сохранён");
        } catch {
          notify("Не удалось сохранить профиль");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="profile-avatar">
        <span className="avatar">
          {avatar ? (
            <ImageView path={avatar} bucket="avatars" />
          ) : (
            name.slice(0, 1)
          )}
        </span>
        <label className="upload">
          Изменить аватар
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              if (!e.target.files?.[0]) return;
              try {
                setAvatar(await repository.image("avatars", e.target.files[0]));
              } catch (err) {
                notify((err as Error).message);
              }
            }}
          />
        </label>
      </div>
      <label>
        Имя
        <input
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button disabled={busy || !name.trim()} className="primary">
        Сохранить
      </button>
    </form>
  );
}
function PublicContent({
  result,
}: {
  result: Awaited<ReturnType<Repository["public"]>>;
}) {
  return (
    <div className="public-content">
      <span className="avatar">{result.name.slice(0, 1)}</span>
      <h1>{result.name}</h1>
      <p className="muted">То, что уже получилось</p>
      {result.goals.map((g, i) => (
        <article className="public-goal" key={i}>
          <Category name={g.category} />
          <h2>{g.title}</h2>
          <p className="completed">
            <Check size={15} />
            {g.completed_on &&
              new Date(g.completed_on + "T12:00:00").toLocaleDateString("ru", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
          </p>
          {g.body && <Markdown body={g.body} />}
        </article>
      ))}
      {!result.goals.length && (
        <p className="muted">Пока нет опубликованных целей</p>
      )}
    </div>
  );
}
function PublicPage() {
  const { slug: publicSlug } = useParams();
  const [result, setResult] = useState<Awaited<
    ReturnType<Repository["public"]>
  > | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    repository
      .public(publicSlug!)
      .then(setResult)
      .catch(() => setError(true));
  }, [publicSlug]);
  return (
    <main className="public-page">
      <div className="brand">
        <Constellation />
        Within
      </div>
      {error ? (
        <p>Не удалось открыть профиль. Попробуйте обновить страницу.</p>
      ) : !result ? (
        <p>Загрузка…</p>
      ) : result.name ? (
        <PublicContent result={result} />
      ) : (
        <Empty icon={Leaf} text="Это пространство недоступно" />
      )}
    </main>
  );
}
function AccountSettings({ notify }: { notify: (s: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(false);
  useEffect(() => {
    void supabase?.auth
      .getUser()
      .then((r) => setEmail(r.data.user?.email || ""));
  }, []);
  return (
    <div className="account-settings">
      <label>
        Email
        <input aria-label="Email" readOnly value={email} />
      </label>
      <button className="text-button" onClick={() => setPassword(true)}>
        Сменить пароль
      </button>
      <button
        className="secondary"
        onClick={() =>
          void supabase!.auth.signOut().then(({ error }) => {
            if (error) notify("Не удалось выйти");
          })
        }
      >
        Выйти
      </button>
      {password && (
        <Modal title="Смена пароля" close={() => setPassword(false)}>
          <p className="muted">
            Отправим письмо со ссылкой для установки нового пароля.
          </p>
          <button
            className="primary"
            onClick={async () => {
              const { error } = await supabase!.auth.resetPasswordForEmail(
                email,
                { redirectTo: locationOrigin() + "/reset-password" },
              );
              if (error) notify(authErrorMessage(error, "forgot"));
              else {
                notify("Проверь почту");
                setPassword(false);
              }
            }}
          >
            Отправить письмо
          </button>
        </Modal>
      )}
    </div>
  );
}
function AuthPage() {
  const nav = useNavigate();
  const location = useLocation();
  const mode =
    location.pathname === "/register"
      ? "register"
      : location.pathname === "/forgot-password"
        ? "forgot"
        : "login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    setError("");
    setSent(false);
    setPassword("");
  }, [mode]);
  return (
    <div className="auth">
      <section className="auth-card">
        <div className="brand">
          <Constellation />
          Within
        </div>
        {sent ? (
          <>
            <h1>Проверь почту</h1>
            <p className="muted">
              Если письмо доступно для этого адреса, оно придёт со ссылкой.
              Открой её, чтобы продолжить.
            </p>
            <NavLink className="text-button" to="/login">
              Вернуться ко входу
            </NavLink>
          </>
        ) : (
          <>
            <h1>
              {mode === "register"
                ? "Создать своё пространство"
                : mode === "forgot"
                  ? "Восстановить пароль"
                  : "С возвращением"}
            </h1>
            <p className="muted">
              {mode === "register"
                ? "Мысли и желания будут только твоими."
                : "Твоё пространство ждёт тебя."}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  if (mode === "register") {
                    const { data, error } = await supabase!.auth.signUp({
                      email,
                      password,
                      options: {
                        data: { display_name: name.trim() },
                        emailRedirectTo: locationOrigin() + "/auth/callback",
                      },
                    });
                    if (error) throw error;
                    setPassword("");
                    if (!data.session) setSent(true);
                    else nav("/goals");
                  } else if (mode === "forgot") {
                    const { error } =
                      await supabase!.auth.resetPasswordForEmail(email, {
                        redirectTo: locationOrigin() + "/reset-password",
                      });
                    if (error) throw error;
                    setSent(true);
                  } else {
                    const { error } = await supabase!.auth.signInWithPassword({
                      email,
                      password,
                    });
                    if (error) throw error;
                    setPassword("");
                    nav("/goals");
                  }
                } catch (error) {
                  setError(authErrorMessage(error, mode));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {mode === "register" && (
                <label>
                  Имя
                  <input
                    required
                    value={name}
                    maxLength={100}
                    autoComplete="name"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  required
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {mode !== "forgot" && (
                <label>
                  Пароль
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    autoComplete={
                      mode === "register" ? "new-password" : "current-password"
                    }
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Подождите…"
                  : mode === "register"
                    ? "Зарегистрироваться"
                    : mode === "forgot"
                      ? "Отправить ссылку"
                      : "Войти"}
              </button>
            </form>
            {googleEnabled && mode !== "forgot" && (
              <button
                className="secondary google-button"
                onClick={async () => {
                  const { error } = await supabase!.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: locationOrigin() + "/auth/callback",
                    },
                  });
                  if (error) setError("Не удалось открыть Google");
                }}
              >
                Войти через Google
              </button>
            )}
            <div className="auth-links">
              <NavLink
                className="text-button"
                to={mode === "login" ? "/register" : "/login"}
              >
                {mode === "login" ? "Создать аккаунт" : "Войти"}
              </NavLink>
              {mode === "login" && (
                <NavLink className="text-button" to="/forgot-password">
                  Забыли пароль?
                </NavLink>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function ResetPassword({
  session,
  recovery,
}: {
  session: Session | null;
  recovery: boolean;
}) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div className="auth">
      <section className="auth-card">
        <div className="brand">
          <Constellation />
          Within
        </div>
        <h1>Новый пароль</h1>
        {!session || !recovery ? (
          <>
            <p className="muted">
              Открой страницу по ссылке из письма для восстановления пароля.
            </p>
            <NavLink className="text-button" to="/forgot-password">
              Получить новую ссылку
            </NavLink>
          </>
        ) : done ? (
          <>
            <p>Пароль изменён.</p>
            <NavLink className="primary" to="/goals">
              Вернуться в Within
            </NavLink>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (password !== repeat) {
                setMessage("Пароли не совпадают");
                return;
              }
              setBusy(true);
              const { error } = await supabase!.auth.updateUser({ password });
              setBusy(false);
              if (error)
                setMessage(
                  "Не удалось изменить пароль. Запросите новую ссылку.",
                );
              else {
                setPassword("");
                setRepeat("");
                sessionStorage.removeItem("my-world-recovery");
                setDone(true);
              }
            }}
          >
            <label>
              Новый пароль
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Повторите пароль
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
            </label>
            {message && (
              <p role="alert" className="error">
                {message}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Сохранение…" : "Сохранить пароль"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
function Welcome({
  session,
  finish,
}: {
  session: Session;
  finish: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start(examples: boolean) {
    setBusy(true);
    try {
      if (examples) {
        const key = "my-world-onboarding:" + session.user.id;
        const cached = localStorage.getItem(key);
        const goals: Goal[] = cached
          ? JSON.parse(cached)
          : seed(session.user.id).goals.slice(0, 3);
        localStorage.setItem(key, JSON.stringify(goals));
        for (const g of goals) await repository.put("goals", g);
      }
      const { error } = await supabase!.auth.updateUser({
        data: { onboarded: true },
      });
      if (error) throw error;
      localStorage.removeItem("my-world-onboarding:" + session.user.id);
      finish();
    } catch {
      setError("Не удалось сохранить. Попробуй снова.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <section className="auth-card">
        <div className="brand">
          <Constellation />
          Within
        </div>
        <h1>Привет, {session.user.user_metadata.display_name || "друг"}</h1>
        <p className="muted">
          Здесь можно записывать мысли и сохранять то, что хочется осуществить.
          Начни так, как тебе удобно.
        </p>
        {error && <p className="error">{error}</p>}
        <button
          className="primary"
          disabled={busy}
          onClick={() => start(false)}
        >
          Начать с пустого пространства
        </button>
        <button
          className="secondary google-button"
          disabled={busy}
          onClick={() => start(true)}
        >
          Добавить три примера
        </button>
        <p className="notice">
          Примеры — обычные цели. Их можно изменить или удалить.
        </p>
      </section>
    </div>
  );
}
export function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovery, setRecovery] = useState(() => {
    try {
      const flag = JSON.parse(
        sessionStorage.getItem("my-world-recovery") || "null",
      );
      return (
        window.location.hash.includes("type=recovery") ||
        !!(flag && flag.until > Date.now())
      );
    } catch {
      return false;
    }
  });
  const [welcomed, setWelcomed] = useState(false);
  const location = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        if (next)
          sessionStorage.setItem(
            "my-world-recovery",
            JSON.stringify({
              uid: next.user.id,
              until: Date.now() + 15 * 60 * 1000,
            }),
          );
      }
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("my-world-recovery");
        setRecovery(false);
      }
      if (next) repository = new SupabaseRepository(next.user.id);
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session)
        repository = new SupabaseRepository(data.session.user.id);
      setSession(data.session);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (
      ready &&
      session &&
      ["/login", "/register", "/auth/callback", "/forgot-password"].includes(
        location.pathname,
      )
    )
      nav("/goals", { replace: true });
  }, [ready, session, location.pathname, nav]);
  if (location.pathname.startsWith("/u/"))
    return (
      <Routes>
        <Route path="/u/:slug" element={<PublicPage />} />
      </Routes>
    );
  if (!ready)
    return <div className="loading">Открываем твоё пространство…</div>;
  if (!supabase) return <App />;
  if (location.pathname === "/reset-password")
    return <ResetPassword session={session} recovery={recovery} />;
  if (!session) return <AuthPage />;
  if (!welcomed && !session.user.user_metadata.onboarded)
    return <Welcome session={session} finish={() => setWelcomed(true)} />;
  return <App key={session.user.id} />;
}
