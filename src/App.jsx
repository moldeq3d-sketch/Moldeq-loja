import { useState, useEffect, useRef, useMemo } from "react";
import { ShoppingCart, X, Plus, Minus, Trash2, Pencil, Lock, ImagePlus, Check, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search, Settings, PackagePlus, Unlock, Film, Ruler, TrendingUp, Package, ClipboardList, Megaphone, Image as ImageIcon } from "lucide-react";
import { supabase } from "./supabaseClient";
import { INITIAL_PRODUCTS, LOGO_URI, PATTERN_URI, INITIAL_BANNERS, DEFAULT_WHATSAPP, ADMIN_PIN, ADMIN_ACCESS_KEY, STORAGE_KEY } from "./data";

function formatBRL(v) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

function uid() {
  return "p" + Math.random().toString(36).slice(2, 9);
}

function buildWhatsAppMessage(cart, products, note) {
  const lines = ["Olá! Vim pelo site da Moldeq e gostaria de fazer o seguinte pedido:", ""];
  let total = 0;
  cart.forEach((item) => {
    const p = products.find((pr) => pr.id === item.productId);
    if (!p) return;
    const subtotal = p.price * item.qty;
    total += subtotal;
    let desc = "• " + p.name;
    if (item.colorName) desc += " — cor " + item.colorName;
    if (item.sizeName) desc += " — tamanho " + item.sizeName;
    desc += " — qtd " + item.qty + " — " + formatBRL(subtotal);
    lines.push(desc);
  });
  lines.push("");
  lines.push("Total: " + formatBRL(total));
  if (note && note.trim()) {
    lines.push("");
    lines.push("Obs: " + note.trim());
  }
  return lines.join("\n");
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url) || url.startsWith("data:video");
}

function youtubeEmbedUrl(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  return m ? "https://www.youtube.com/embed/" + m[1] : null;
}

const PALETTE = {
  bg: "#14161C",
  bg2: "#0F1116",
  surface: "#1C1F29",
  surface2: "#232733",
  border: "rgba(241,238,228,0.09)",
  gold: "#D9A44C",
  goldBright: "#F0C77A",
  purple: "#8A6FB0",
  purpleDeep: "#6B4E9E",
  text: "#F1EEE4",
  muted: "#9297A3",
  danger: "#C0392B",
};

function LayerLines({ height = 28, opacity = 0.35, color = PALETTE.gold }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width: "100%",
        backgroundImage:
          "repeating-linear-gradient(0deg, " +
          color +
          " 0px, " +
          color +
          " 1px, transparent 1px, transparent 6px)",
        opacity,
      }}
    />
  );
}

function ColorSwatch({ color, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={color.name + (disabled ? " — esgotado" : "")}
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: color.hex,
        border: selected ? "2px solid " + PALETTE.goldBright : "2px solid rgba(241,238,228,0.25)",
        boxShadow: selected ? "0 0 0 3px rgba(240,199,122,0.25)" : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : 1,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {disabled && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ width: "140%", height: 1.5, background: "#fff", transform: "rotate(45deg)" }} />
        </span>
      )}
    </button>
  );
}

function SizeButton({ size, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 10px",
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 600,
        background: selected ? PALETTE.gold : "transparent",
        color: selected ? "#1A1204" : disabled ? PALETTE.muted : PALETTE.text,
        border: "1px solid " + (selected ? PALETTE.gold : PALETTE.border),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        textDecoration: disabled ? "line-through" : "none",
      }}
    >
      {size.name}
    </button>
  );
}

function MediaViewer({ gallery, height = "auto" }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [gallery.length > 0 ? gallery[0].url : null]);

  const safeIdx = Math.min(idx, gallery.length - 1);
  const item = gallery[safeIdx];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {item.type === "video" ? (
        youtubeEmbedUrl(item.url) ? (
          <iframe
            src={youtubeEmbedUrl(item.url)}
            title="video"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video src={item.url} controls style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }} />
        )
      ) : (
        <img
          src={item.url}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            padding: "6%",
            boxSizing: "border-box",
            background: PALETTE.surface,
          }}
        />
      )}

      {gallery.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i - 1 + gallery.length) % gallery.length);
            }}
            style={navArrowStyle("left")}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i + 1) % gallery.length);
            }}
            style={navArrowStyle("right")}
          >
            <ChevronRight size={16} />
          </button>
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
            {gallery.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: i === safeIdx ? PALETTE.goldBright : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function navArrowStyle(side) {
  return {
    position: "absolute",
    top: "50%",
    [side]: 6,
    transform: "translateY(-50%)",
    background: "rgba(15,17,22,0.6)",
    border: "none",
    borderRadius: "50%",
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "pointer",
  };
}

function BannerCarousel({ banners }) {
  const active = (banners || []).filter((b) => b.active);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (active.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % active.length), 6000);
    return () => clearInterval(t);
  }, [active.length]);

  if (active.length === 0) return null;
  const safeIdx = Math.min(idx, active.length - 1);
  const b = active[safeIdx];

  function scrollToCatalog() {
    const el = document.getElementById("catalogo");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto 0", padding: "0 20px" }}>
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", aspectRatio: "21/8", background: PALETTE.surface, border: "1px solid " + PALETTE.border }}>
        <img src={b.image} alt={b.title || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(15,17,22,0.85) 20%, rgba(15,17,22,0.25) 65%, transparent)",
          }}
        />
        <div style={{ position: "absolute", left: "5%", top: "50%", transform: "translateY(-50%)", maxWidth: "55%" }}>
          {b.title && (
            <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(18px, 3vw, 32px)", color: PALETTE.text, lineHeight: 1.15 }}>
              {b.title}
            </h2>
          )}
          {b.subtitle && <p style={{ margin: "8px 0 0", color: PALETTE.text, opacity: 0.85, fontSize: "clamp(12px, 1.4vw, 15px)" }}>{b.subtitle}</p>}
          {b.ctaText &&
            (b.ctaLink ? (
              <a
                href={b.ctaLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  textDecoration: "none",
                  background: "linear-gradient(135deg," + PALETTE.gold + "," + PALETTE.goldBright + ")",
                  color: "#1A1204",
                  fontWeight: 700,
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {b.ctaText}
              </a>
            ) : (
              <button
                onClick={scrollToCatalog}
                style={{
                  marginTop: 14,
                  border: "none",
                  cursor: "pointer",
                  background: "linear-gradient(135deg," + PALETTE.gold + "," + PALETTE.goldBright + ")",
                  color: "#1A1204",
                  fontWeight: 700,
                  padding: "10px 18px",
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {b.ctaText}
              </button>
            ))}
        </div>

        {active.length > 1 && (
          <>
            <button type="button" onClick={() => setIdx((i) => (i - 1 + active.length) % active.length)} style={navArrowStyle("left")}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setIdx((i) => (i + 1) % active.length)} style={navArrowStyle("right")}>
              <ChevronRight size={18} />
            </button>
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
              {active.map((_, i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === safeIdx ? PALETTE.goldBright : "rgba(255,255,255,0.4)" }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, onAddToCart, toast }) {
  const availableColors = (product.colors || []).filter((c) => c.stock > 0);
  const [colorName, setColorName] = useState(availableColors[0] ? availableColors[0].name : (product.colors && product.colors[0] ? product.colors[0].name : ""));
  const availableSizes = (product.sizes || []).filter((s) => s.stock > 0);
  const [sizeName, setSizeName] = useState(availableSizes[0] ? availableSizes[0].name : "");
  const [qty, setQty] = useState(1);
  const selectedColor = (product.colors || []).find((c) => c.name === colorName);
  const selectedSize = (product.sizes || []).find((s) => s.name === sizeName);
  const hasColors = (product.colors || []).length > 0;
  const hasSizes = (product.sizes || []).length > 0;
  const outOfStock = (hasColors && availableColors.length === 0) || (hasSizes && availableSizes.length === 0);
  const maxQty = Math.max(1, Math.min(selectedColor ? selectedColor.stock : Infinity, selectedSize ? selectedSize.stock : Infinity));

  useEffect(() => {
    setQty(1);
  }, [colorName, sizeName]);

  const media = product.media && product.media.length > 0 ? product.media : [{ type: "image", url: product.images ? product.images[0] : "" }];
  const gallery = selectedColor && selectedColor.image ? [{ type: "image", url: selectedColor.image }, ...media.filter((m) => m.url !== selectedColor.image)] : media;

  return (
    <div
      style={{
        background: PALETTE.surface,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid " + PALETTE.border,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LayerLines height={10} opacity={0.5} />
      <div style={{ position: "relative", aspectRatio: "4/3", background: PALETTE.surface }}>
        <MediaViewer gallery={gallery} />
        {outOfStock && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(20,22,28,0.85)",
              color: PALETTE.muted,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid " + PALETTE.border,
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            Esgotado
          </div>
        )}
      </div>
      <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 16,
              fontWeight: 600,
              color: PALETTE.text,
              lineHeight: 1.3,
              minHeight: 42,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.name}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: PALETTE.muted,
              lineHeight: 1.45,
              minHeight: 38,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.description}
          </p>
        </div>

        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, color: PALETTE.goldBright, minHeight: 24 }}>
          {product.priceFrom ? "a partir de " : ""}
          {formatBRL(product.price)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: hasColors ? 26 : 0 }}>
          {hasColors &&
            product.colors.map((c) => (
              <ColorSwatch key={c.name} color={c} selected={colorName === c.name} disabled={c.stock <= 0} onClick={() => setColorName(c.name)} />
            ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minHeight: hasSizes ? 26 : 0 }}>
          {hasSizes &&
            product.sizes.map((s) => (
              <SizeButton key={s.name} size={s} selected={sizeName === s.name} disabled={s.stock <= 0} onClick={() => setSizeName(s.name)} />
            ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid " + PALETTE.border,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={outOfStock}
              style={{ background: "transparent", border: "none", color: PALETTE.text, padding: "8px 10px", cursor: "pointer" }}
            >
              <Minus size={14} />
            </button>
            <span style={{ minWidth: 22, textAlign: "center", fontSize: 14, color: PALETTE.text }}>{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))}
              disabled={outOfStock}
              style={{ background: "transparent", border: "none", color: PALETTE.text, padding: "8px 10px", cursor: "pointer" }}
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => {
              onAddToCart(product.id, colorName, sizeName, qty);
              toast(product.name + " adicionado ao carrinho");
            }}
            style={{
              flex: 1,
              background: outOfStock ? "rgba(217,164,76,0.15)" : "linear-gradient(135deg," + PALETTE.gold + "," + PALETTE.goldBright + ")",
              color: outOfStock ? PALETTE.muted : "#1A1204",
              border: "none",
              borderRadius: 10,
              padding: "10px 12px",
              fontWeight: 700,
              fontSize: 13,
              cursor: outOfStock ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <ShoppingCart size={15} />
            {outOfStock ? "Indisponível" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, cart, products, onRemove, onQtyChange, whatsapp, note, setNote, onSent }) {
  const total = cart.reduce((sum, item) => {
    const p = products.find((pr) => pr.id === item.productId);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(8,9,12,0.6)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(400px, 100vw)",
          background: PALETTE.bg2,
          borderLeft: "1px solid " + PALETTE.border,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "20px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid " + PALETTE.border }}>
          <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: PALETTE.text }}>Seu carrinho</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {cart.length === 0 ? (
            <p style={{ color: PALETTE.muted, fontSize: 14 }}>Seu carrinho está vazio. Adicione produtos do catálogo para montar seu pedido.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {cart.map((item, idx) => {
                const p = products.find((pr) => pr.id === item.productId);
                if (!p) return null;
                const thumb = (p.media && p.media[0] && p.media[0].url) || (p.images && p.images[0]) || "";
                return (
                  <div key={idx} style={{ display: "flex", gap: 10, borderBottom: "1px solid " + PALETTE.border, paddingBottom: 14 }}>
                    <img src={thumb} alt={p.name} style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: PALETTE.text, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>
                        {item.colorName ? "Cor: " + item.colorName : ""}
                        {item.colorName && item.sizeName ? " · " : ""}
                        {item.sizeName ? "Tamanho: " + item.sizeName : ""}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <button onClick={() => onQtyChange(idx, -1)} style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.text, cursor: "pointer", padding: "2px 6px" }}>
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: 13, color: PALETTE.text }}>{item.qty}</span>
                        <button onClick={() => onQtyChange(idx, 1)} style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.text, cursor: "pointer", padding: "2px 6px" }}>
                          <Plus size={12} />
                        </button>
                        <span style={{ marginLeft: "auto", fontSize: 13, color: PALETTE.goldBright, fontWeight: 700 }}>{formatBRL(p.price * item.qty)}</span>
                      </div>
                    </div>
                    <button onClick={() => onRemove(idx)} style={{ background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer", alignSelf: "flex-start" }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: 20, borderTop: "1px solid " + PALETTE.border, display: "flex", flexDirection: "column", gap: 12 }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observações (opcional): endereço, prazo, personalização..."
              rows={2}
              style={{
                width: "100%",
                background: PALETTE.surface,
                border: "1px solid " + PALETTE.border,
                borderRadius: 8,
                color: PALETTE.text,
                padding: 10,
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: PALETTE.text }}>
              <span>Total</span>
              <span style={{ fontWeight: 700, color: PALETTE.goldBright }}>{formatBRL(total)}</span>
            </div>
            <a
              href={"https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(buildWhatsAppMessage(cart, products, note))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onSent}
              style={{
                textDecoration: "none",
                textAlign: "center",
                background: "#25D366",
                color: "#0A2E1A",
                fontWeight: 700,
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 14,
              }}
            >
              Finalizar pedido no WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  );
}

function AdminProductForm({ product, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(() => {
    const base = JSON.parse(JSON.stringify(product));
    if (!base.media || base.media.length === 0) {
      base.media = base.images ? base.images.map((u) => ({ type: "image", url: u })) : [];
    }
    if (!base.sizes) base.sizes = [];
    base.colors = (base.colors || []).map((c) => ({ image: null, ...c }));
    return base;
  });
  const photoInputRef = useRef(null);
  const colorPhotoInputRefs = useRef({});
  const [videoUrlDraft, setVideoUrlDraft] = useState("");

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateColor(idx, field, value) {
    setForm((f) => {
      const colors = [...f.colors];
      colors[idx] = { ...colors[idx], [field]: field === "stock" ? Number(value) : value };
      return { ...f, colors };
    });
  }

  function addColor() {
    setForm((f) => ({ ...f, colors: [...f.colors, { name: "Nova cor", hex: "#D9A44C", stock: 0, image: null }] }));
  }

  function removeColor(idx) {
    setForm((f) => ({ ...f, colors: f.colors.filter((_, i) => i !== idx) }));
  }

  function updateSize(idx, field, value) {
    setForm((f) => {
      const sizes = [...f.sizes];
      sizes[idx] = { ...sizes[idx], [field]: field === "stock" ? Number(value) : value };
      return { ...f, sizes };
    });
  }

  function addSize() {
    setForm((f) => ({ ...f, sizes: [...f.sizes, { name: "Novo tamanho", stock: 0 }] }));
  }

  function removeSize(idx) {
    setForm((f) => ({ ...f, sizes: f.sizes.filter((_, i) => i !== idx) }));
  }

  async function handlePhotosUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const uris = await Promise.all(files.map(fileToDataUri));
    setForm((f) => ({ ...f, media: [...f.media, ...uris.map((u) => ({ type: "image", url: u }))] }));
    e.target.value = "";
  }

  async function handleVideoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const uri = await fileToDataUri(file);
    setForm((f) => ({ ...f, media: [...f.media, { type: "video", url: uri }] }));
    e.target.value = "";
  }

  function addVideoUrl() {
    if (!videoUrlDraft.trim()) return;
    setForm((f) => ({ ...f, media: [...f.media, { type: "video", url: videoUrlDraft.trim() }] }));
    setVideoUrlDraft("");
  }

  function removeMedia(idx) {
    setForm((f) => ({ ...f, media: f.media.filter((_, i) => i !== idx) }));
  }

  function moveMediaFirst(idx) {
    setForm((f) => {
      const media = [...f.media];
      const [item] = media.splice(idx, 1);
      media.unshift(item);
      return { ...f, media };
    });
  }

  async function handleColorPhoto(idx, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const uri = await fileToDataUri(file);
    updateColor(idx, "image", uri);
    e.target.value = "";
  }

  return (
    <div style={{ background: PALETTE.surface2, borderRadius: 12, padding: 18, border: "1px solid " + PALETTE.border, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 8 }}>Fotos e vídeo do produto (carrossel)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {form.media.map((m, idx) => (
            <div key={idx} style={{ position: "relative", width: 84, height: 84, borderRadius: 8, overflow: "hidden", border: "1px solid " + PALETTE.border, flexShrink: 0 }}>
              {m.type === "video" ? (
                <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Film size={20} color={PALETTE.gold} />
                </div>
              ) : (
                <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              <button
                type="button"
                onClick={() => removeMedia(idx)}
                style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              >
                <X size={11} />
              </button>
              {idx !== 0 && (
                <button
                  type="button"
                  onClick={() => moveMediaFirst(idx)}
                  title="Definir como capa"
                  style={{ position: "absolute", bottom: 2, left: 2, right: 2, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", fontSize: 9, padding: "2px 0" }}
                >
                  Capa
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => photoInputRef.current && photoInputRef.current.click()}
            style={{ width: 84, height: 84, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "transparent", border: "1px dashed " + PALETTE.border, borderRadius: 8, color: PALETTE.muted, cursor: "pointer", fontSize: 11 }}
          >
            <ImagePlus size={16} /> Fotos
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotosUpload} style={{ display: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
            <Film size={13} /> Enviar vídeo
            <input type="file" accept="video/*" onChange={handleVideoUpload} style={{ display: "none" }} />
          </label>
          <input
            value={videoUrlDraft}
            onChange={(e) => setVideoUrlDraft(e.target.value)}
            placeholder="ou cole um link de vídeo (YouTube, .mp4...)"
            style={{ flex: 1, minWidth: 180, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 10px", fontSize: 12 }}
          />
          <button type="button" onClick={addVideoUrl} style={{ background: "transparent", border: "1px solid " + PALETTE.gold, color: PALETTE.gold, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
            Adicionar link
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, color: PALETTE.muted }}>
          Nome do produto
          <input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
          />
        </label>
        <label style={{ fontSize: 12, color: PALETTE.muted }}>
          Descrição
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={2}
            style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Preço (R$)
            <input
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => updateField("price", Number(e.target.value))}
              style={{ display: "block", marginTop: 4, width: 110, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
            <input type="checkbox" checked={form.priceFrom} onChange={(e) => updateField("priceFrom", e.target.checked)} />
            Mostrar "a partir de"
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => updateField("active", e.target.checked)} />
            Ativo na loja
          </label>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 6 }}>Cores e estoque</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.colors.map((c, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="color"
                value={c.hex}
                onChange={(e) => updateColor(idx, "hex", e.target.value)}
                style={{ width: 32, height: 32, border: "none", background: "none", padding: 0, cursor: "pointer" }}
              />
              <input
                value={c.name}
                onChange={(e) => updateColor(idx, "name", e.target.value)}
                placeholder="Nome da cor"
                style={{ width: 110, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 8px", fontSize: 13 }}
              />
              <input
                type="number"
                value={c.stock}
                onChange={(e) => updateColor(idx, "stock", e.target.value)}
                placeholder="Estoque"
                style={{ width: 80, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 8px", fontSize: 13 }}
              />
              {c.image ? (
                <div style={{ position: "relative", width: 30, height: 30, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                  <img src={c.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    type="button"
                    onClick={() => updateColor(idx, "image", null)}
                    style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer", fontSize: 10 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => colorPhotoInputRefs.current[idx] && colorPhotoInputRefs.current[idx].click()}
                  title="Foto específica desta cor"
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px dashed " + PALETTE.border, color: PALETTE.muted, borderRadius: 8, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  <ImagePlus size={12} /> Foto da cor
                </button>
              )}
              <input
                ref={(el) => (colorPhotoInputRefs.current[idx] = el)}
                type="file"
                accept="image/*"
                onChange={(e) => handleColorPhoto(idx, e)}
                style={{ display: "none" }}
              />
              <button onClick={() => removeColor(idx)} style={{ background: "transparent", border: "none", color: PALETTE.danger, cursor: "pointer" }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            onClick={addColor}
            style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px dashed " + PALETTE.border, color: PALETTE.muted, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", marginTop: 2 }}
          >
            <Plus size={13} /> Adicionar cor
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <Ruler size={13} /> Tamanhos ou modelos (opcional)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {form.sizes.map((s, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                value={s.name}
                onChange={(e) => updateSize(idx, "name", e.target.value)}
                placeholder="Ex: P, M, G ou 15x20cm"
                style={{ width: 150, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 8px", fontSize: 13 }}
              />
              <input
                type="number"
                value={s.stock}
                onChange={(e) => updateSize(idx, "stock", e.target.value)}
                placeholder="Estoque"
                style={{ width: 90, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 8px", fontSize: 13 }}
              />
              <button onClick={() => removeSize(idx)} style={{ background: "transparent", border: "none", color: PALETTE.danger, cursor: "pointer" }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            onClick={addSize}
            style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px dashed " + PALETTE.border, color: PALETTE.muted, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", marginTop: 2 }}
          >
            <Plus size={13} /> Adicionar tamanho
          </button>
        </div>
        {form.sizes.length === 0 && (
          <p style={{ fontSize: 11, color: PALETTE.muted, marginTop: 4 }}>Deixe em branco se o produto não tiver variações de tamanho.</p>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 4 }}>
        <button
          onClick={() => onDelete(form.id)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.danger, color: PALETTE.danger, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
        >
          <Trash2 size={14} /> Excluir produto
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <Check size={14} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDatePt(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
}

function AdminStockSales({ products, setProducts, sales, setSales }) {
  const activeProducts = products;
  const [saleProductId, setSaleProductId] = useState(activeProducts[0] ? activeProducts[0].id : "");
  const saleProduct = activeProducts.find((p) => p.id === saleProductId);
  const [saleColor, setSaleColor] = useState("");
  const [saleSize, setSaleSize] = useState("");
  const [saleQty, setSaleQty] = useState(1);

  useEffect(() => {
    if (!saleProduct) return;
    setSaleColor(saleProduct.colors && saleProduct.colors[0] ? saleProduct.colors[0].name : "");
    setSaleSize(saleProduct.sizes && saleProduct.sizes[0] ? saleProduct.sizes[0].name : "");
    setSaleQty(1);
  }, [saleProductId]);

  function updateColorStock(productId, colorIdx, value) {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const colors = [...p.colors];
        colors[colorIdx] = { ...colors[colorIdx], stock: Math.max(0, Number(value) || 0) };
        return { ...p, colors };
      })
    );
  }

  function updateSizeStock(productId, sizeIdx, value) {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const sizes = [...p.sizes];
        sizes[sizeIdx] = { ...sizes[sizeIdx], stock: Math.max(0, Number(value) || 0) };
        return { ...p, sizes };
      })
    );
  }

  function registerSale() {
    if (!saleProduct) return;
    const hasColors = (saleProduct.colors || []).length > 0;
    const hasSizes = (saleProduct.sizes || []).length > 0;
    const colorObj = hasColors ? saleProduct.colors.find((c) => c.name === saleColor) : null;
    const sizeObj = hasSizes ? saleProduct.sizes.find((s) => s.name === saleSize) : null;
    const qty = Math.max(1, Number(saleQty) || 1);

    if (hasColors && (!colorObj || colorObj.stock < qty)) {
      alert("Estoque insuficiente para essa cor.");
      return;
    }
    if (hasSizes && (!sizeObj || sizeObj.stock < qty)) {
      alert("Estoque insuficiente para esse tamanho.");
      return;
    }

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== saleProduct.id) return p;
        const next = { ...p };
        if (hasColors) {
          next.colors = p.colors.map((c) => (c.name === saleColor ? { ...c, stock: c.stock - qty } : c));
        }
        if (hasSizes) {
          next.sizes = p.sizes.map((s) => (s.name === saleSize ? { ...s, stock: s.stock - qty } : s));
        }
        return next;
      })
    );

    const entry = {
      id: uid(),
      date: new Date().toISOString(),
      productId: saleProduct.id,
      productName: saleProduct.name,
      colorName: hasColors ? saleColor : "",
      sizeName: hasSizes ? saleSize : "",
      qty,
      unitPrice: saleProduct.price,
      total: saleProduct.price * qty,
    };
    setSales((prev) => [entry, ...prev]);
    setSaleQty(1);
  }

  function deleteSale(id) {
    if (!window.confirm("Excluir esta venda do histórico? O estoque não será devolvido automaticamente.")) return;
    setSales((prev) => prev.filter((s) => s.id !== id));
  }

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalUnits = sales.reduce((s, sale) => s + sale.qty, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: PALETTE.muted }}>Receita registrada</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: PALETTE.goldBright, fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(totalRevenue)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: PALETTE.muted }}>Unidades vendidas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: PALETTE.text, fontFamily: "'Space Grotesk', sans-serif" }}>{totalUnits}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: PALETTE.muted }}>Vendas registradas</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: PALETTE.text, fontFamily: "'Space Grotesk', sans-serif" }}>{sales.length}</div>
        </div>
      </div>

      <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <TrendingUp size={16} color={PALETTE.gold} />
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Registrar venda</h3>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Produto
            <select
              value={saleProductId}
              onChange={(e) => setSaleProductId(e.target.value)}
              style={{ display: "block", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, minWidth: 180 }}
            >
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {saleProduct && saleProduct.colors && saleProduct.colors.length > 0 && (
            <label style={{ fontSize: 12, color: PALETTE.muted }}>
              Cor
              <select
                value={saleColor}
                onChange={(e) => setSaleColor(e.target.value)}
                style={{ display: "block", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, minWidth: 140 }}
              >
                {saleProduct.colors.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.stock} em estoque)
                  </option>
                ))}
              </select>
            </label>
          )}
          {saleProduct && saleProduct.sizes && saleProduct.sizes.length > 0 && (
            <label style={{ fontSize: 12, color: PALETTE.muted }}>
              Tamanho
              <select
                value={saleSize}
                onChange={(e) => setSaleSize(e.target.value)}
                style={{ display: "block", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, minWidth: 140 }}
              >
                {saleProduct.sizes.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.stock} em estoque)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Quantidade
            <input
              type="number"
              min={1}
              value={saleQty}
              onChange={(e) => setSaleQty(e.target.value)}
              style={{ display: "block", marginTop: 4, width: 80, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13 }}
            />
          </label>
          {saleProduct && (
            <div style={{ fontSize: 13, color: PALETTE.muted, paddingBottom: 8 }}>
              Total: <span style={{ color: PALETTE.goldBright, fontWeight: 700 }}>{formatBRL(saleProduct.price * Math.max(1, Number(saleQty) || 1))}</span>
            </div>
          )}
          <button
            onClick={registerSale}
            disabled={!saleProduct}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <Check size={14} /> Registrar venda
          </button>
        </div>
      </div>

      <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Package size={16} color={PALETTE.gold} />
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Estoque por produto e cor</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {products.map((p) => (
            <div key={p.id} style={{ borderBottom: "1px solid " + PALETTE.border, paddingBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: PALETTE.text, marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {(p.colors || []).map((c, idx) => (
                  <label key={c.name} style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: c.hex, border: "1px solid " + PALETTE.border, display: "inline-block", flexShrink: 0 }} />
                    {c.name}
                    <input
                      type="number"
                      min={0}
                      value={c.stock}
                      onChange={(e) => updateColorStock(p.id, idx, e.target.value)}
                      style={{ width: 60, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.text, padding: "4px 6px", fontSize: 12 }}
                    />
                  </label>
                ))}
                {(p.sizes || []).map((s, idx) => (
                  <label key={s.name} style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6 }}>
                    <Ruler size={12} />
                    {s.name}
                    <input
                      type="number"
                      min={0}
                      value={s.stock}
                      onChange={(e) => updateSizeStock(p.id, idx, e.target.value)}
                      style={{ width: 60, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.text, padding: "4px 6px", fontSize: 12 }}
                    />
                  </label>
                ))}
                {(!p.colors || p.colors.length === 0) && (!p.sizes || p.sizes.length === 0) && (
                  <span style={{ fontSize: 12, color: PALETTE.muted }}>Sem variações cadastradas.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <ClipboardList size={16} color={PALETTE.gold} />
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Histórico de vendas</h3>
        </div>
        {sales.length === 0 ? (
          <p style={{ fontSize: 13, color: PALETTE.muted }}>Nenhuma venda registrada ainda.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sales.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: PALETTE.text, borderBottom: "1px solid " + PALETTE.border, paddingBottom: 8, flexWrap: "wrap" }}>
                <span style={{ color: PALETTE.muted, minWidth: 130 }}>{formatDatePt(s.date)}</span>
                <span style={{ fontWeight: 600 }}>{s.productName}</span>
                <span style={{ color: PALETTE.muted }}>
                  {s.colorName ? "Cor: " + s.colorName : ""}
                  {s.colorName && s.sizeName ? " · " : ""}
                  {s.sizeName ? "Tam: " + s.sizeName : ""}
                </span>
                <span style={{ color: PALETTE.muted }}>Qtd: {s.qty}</span>
                <span style={{ marginLeft: "auto", color: PALETTE.goldBright, fontWeight: 700 }}>{formatBRL(s.total)}</span>
                <button onClick={() => deleteSale(s.id)} style={{ background: "transparent", border: "none", color: PALETTE.danger, cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminBanners({ banners, setBanners }) {
  const [editingId, setEditingId] = useState(null);
  const fileInputRefs = useRef({});

  function addBanner() {
    const blank = {
      id: uid(),
      image: LOGO_URI,
      title: "Novo banner",
      subtitle: "Descrição curta da promoção",
      ctaText: "Ver catálogo",
      ctaLink: "",
      active: true,
    };
    setBanners((prev) => [blank, ...prev]);
    setEditingId(blank.id);
  }

  function updateBanner(id, field, value) {
    setBanners((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  function deleteBanner(id) {
    if (!window.confirm("Excluir este banner?")) return;
    setBanners((prev) => prev.filter((b) => b.id !== id));
    setEditingId(null);
  }

  function moveBanner(id, dir) {
    setBanners((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(newIdx, 0, item);
      return next;
    });
  }

  async function handleImage(id, e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const uri = await fileToDataUri(file);
    updateBanner(id, "image", uri);
    e.target.value = "";
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Megaphone size={16} color={PALETTE.gold} />
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Banners da página inicial</h3>
        </div>
        <button
          onClick={addBanner}
          style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={14} /> Novo banner
        </button>
      </div>

      {banners.length === 0 && <p style={{ fontSize: 13, color: PALETTE.muted }}>Nenhum banner cadastrado ainda. Clique em "Novo banner" para criar o primeiro.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {banners.map((b, idx) =>
          editingId === b.id ? (
            <div key={b.id} style={{ background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <img src={b.image} alt="" style={{ width: 140, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid " + PALETTE.border }} />
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[b.id] && fileInputRefs.current[b.id].click()}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
                  >
                    <ImageIcon size={13} /> Trocar imagem
                  </button>
                  <input ref={(el) => (fileInputRefs.current[b.id] = el)} type="file" accept="image/*" onChange={(e) => handleImage(b.id, e)} style={{ display: "none" }} />
                </div>
                <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ fontSize: 12, color: PALETTE.muted }}>
                    Título
                    <input
                      value={b.title}
                      onChange={(e) => updateBanner(b.id, "title", e.target.value)}
                      style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
                    />
                  </label>
                  <label style={{ fontSize: 12, color: PALETTE.muted }}>
                    Subtítulo
                    <input
                      value={b.subtitle}
                      onChange={(e) => updateBanner(b.id, "subtitle", e.target.value)}
                      style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 12, color: PALETTE.muted, flex: 1, minWidth: 140 }}>
                      Texto do botão
                      <input
                        value={b.ctaText}
                        onChange={(e) => updateBanner(b.id, "ctaText", e.target.value)}
                        style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                      />
                    </label>
                    <label style={{ fontSize: 12, color: PALETTE.muted, flex: 1, minWidth: 140 }}>
                      Link do botão (opcional)
                      <input
                        value={b.ctaLink}
                        onChange={(e) => updateBanner(b.id, "ctaLink", e.target.value)}
                        placeholder="deixe em branco p/ rolar até o catálogo"
                        style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
                      />
                    </label>
                  </div>
                  <label style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={b.active} onChange={(e) => updateBanner(b.id, "active", e.target.checked)} />
                    Ativo (visível na loja)
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                <button
                  onClick={() => deleteBanner(b.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.danger, color: PALETTE.danger, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
                >
                  <Trash2 size={14} /> Excluir
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  <Check size={14} /> Concluir
                </button>
              </div>
            </div>
          ) : (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 14, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 12, opacity: b.active ? 1 : 0.55 }}>
              <img src={b.image} alt="" style={{ width: 64, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: PALETTE.text, fontWeight: 600 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>{b.active ? "ativo" : "inativo"}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => moveBanner(b.id, -1)} disabled={idx === 0} style={{ background: "transparent", border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.muted, cursor: "pointer", padding: 4 }}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moveBanner(b.id, 1)} disabled={idx === banners.length - 1} style={{ background: "transparent", border: "1px solid " + PALETTE.border, borderRadius: 6, color: PALETTE.muted, cursor: "pointer", padding: 4 }}>
                  <ChevronDown size={14} />
                </button>
              </div>
              <button
                onClick={() => setEditingId(b.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
              >
                <Pencil size={13} /> Editar
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function AdminPanel({ products, setProducts, whatsapp, setWhatsapp, sales, setSales, banners, setBanners, onExit }) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [waDraft, setWaDraft] = useState(whatsapp);
  const [tab, setTab] = useState("products");

  function saveProduct(updated) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingId(null);
  }

  function deleteProduct(id) {
    if (!window.confirm("Excluir este produto definitivamente?")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setEditingId(null);
  }

  function addProduct() {
    const blank = {
      id: uid(),
      name: "Novo produto",
      description: "Descrição do produto",
      price: 0,
      priceFrom: false,
      active: true,
      media: [{ type: "image", url: LOGO_URI }],
      colors: [{ name: "Padrão", hex: "#D9A44C", stock: 10, image: null }],
      sizes: [],
    };
    setProducts((prev) => [blank, ...prev]);
    setEditingId(blank.id);
  }

  if (!unlocked) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
        <Lock size={28} color={PALETTE.gold} />
        <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", color: PALETTE.text }}>Área do vendedor</h2>
        <p style={{ color: PALETTE.muted, fontSize: 13, textAlign: "center", maxWidth: 300 }}>Digite o PIN para acessar o painel de produtos.</p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin === ADMIN_PIN) setUnlocked(true);
          }}
          placeholder="PIN"
          style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "10px 14px", fontSize: 15, textAlign: "center", width: 140 }}
        />
        <button
          onClick={() => {
            if (pin === ADMIN_PIN) setUnlocked(true);
            else alert("PIN incorreto");
          }}
          style={{ background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, cursor: "pointer" }}
        >
          Entrar
        </button>
        <button onClick={onExit} style={{ background: "transparent", border: "none", color: PALETTE.muted, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
          ← Voltar para a loja
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", color: PALETTE.text, fontSize: 22 }}>Painel do vendedor</h2>
          <p style={{ margin: "4px 0 0", color: PALETTE.muted, fontSize: 13 }}>{products.length} produtos cadastrados</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={addProduct}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <PackagePlus size={15} /> Novo produto
          </button>
          <button onClick={onExit} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>
            <ChevronLeft size={15} /> Voltar para a loja
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid " + PALETTE.border }}>
        <button
          onClick={() => setTab("products")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            borderBottom: tab === "products" ? "2px solid " + PALETTE.gold : "2px solid transparent",
            color: tab === "products" ? PALETTE.text : PALETTE.muted,
            padding: "10px 6px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <PackagePlus size={14} /> Produtos
        </button>
        <button
          onClick={() => setTab("stock")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            borderBottom: tab === "stock" ? "2px solid " + PALETTE.gold : "2px solid transparent",
            color: tab === "stock" ? PALETTE.text : PALETTE.muted,
            padding: "10px 6px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <TrendingUp size={14} /> Estoque & Vendas
        </button>
        <button
          onClick={() => setTab("banners")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            borderBottom: tab === "banners" ? "2px solid " + PALETTE.gold : "2px solid transparent",
            color: tab === "banners" ? PALETTE.text : PALETTE.muted,
            padding: "10px 6px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Megaphone size={14} /> Banners
        </button>
      </div>

      {tab === "products" ? (
        <>
          <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Settings size={16} color={PALETTE.gold} />
            <label style={{ fontSize: 13, color: PALETTE.muted }}>
              Número de WhatsApp para pedidos (com DDI+DDD, só números):
            </label>
            <input
              value={waDraft}
              onChange={(e) => setWaDraft(e.target.value.replace(/[^0-9]/g, ""))}
              style={{ background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "7px 10px", fontSize: 13, width: 160 }}
            />
            <button
              onClick={() => setWhatsapp(waDraft)}
              style={{ background: "transparent", border: "1px solid " + PALETTE.gold, color: PALETTE.gold, borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer" }}
            >
              Salvar número
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {products.map((p) =>
              editingId === p.id ? (
                <AdminProductForm key={p.id} product={p} onSave={saveProduct} onCancel={() => setEditingId(null)} onDelete={deleteProduct} />
              ) : (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    background: PALETTE.surface,
                    border: "1px solid " + PALETTE.border,
                    borderRadius: 12,
                    padding: 12,
                    opacity: p.active ? 1 : 0.55,
                  }}
                >
                  <img
                    src={(p.media && p.media[0] && p.media[0].url) || (p.images && p.images[0]) || LOGO_URI}
                    alt={p.name}
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: PALETTE.text, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>
                      {(p.priceFrom ? "a partir de " : "") + formatBRL(p.price)} · {(p.colors || []).reduce((s, c) => s + c.stock, 0)} un. em estoque
                      {p.sizes && p.sizes.length > 0 ? " · " + p.sizes.length + " tamanho(s)" : ""} · {p.active ? "ativo" : "inativo"}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingId(p.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
                  >
                    <Pencil size={13} /> Editar
                  </button>
                </div>
              )
            )}
          </div>
        </>
      ) : tab === "stock" ? (
        <AdminStockSales products={products} setProducts={setProducts} sales={sales} setSales={setSales} />
      ) : (
        <AdminBanners banners={banners} setBanners={setBanners} />
      )}
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: PALETTE.surface2,
        border: "1px solid " + PALETTE.gold,
        color: PALETTE.text,
        padding: "10px 18px",
        borderRadius: 10,
        fontSize: 13,
        zIndex: 60,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      {message}
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [whatsapp, setWhatsapp] = useState(DEFAULT_WHATSAPP);
  const [sales, setSales] = useState([]);
  const [banners, setBanners] = useState(INITIAL_BANNERS);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("shop");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("acesso") === ADMIN_ACCESS_KEY) {
        setView("admin");
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("moldeq_catalog").select("data").eq("id", STORAGE_KEY).maybeSingle();
        if (error) throw error;
        if (data && data.data) {
          setProducts(data.data.products || INITIAL_PRODUCTS);
          setWhatsapp(data.data.whatsapp || DEFAULT_WHATSAPP);
          setSales(data.data.sales || []);
          setBanners(data.data.banners || INITIAL_BANNERS);
        } else {
          await supabase.from("moldeq_catalog").upsert({ id: STORAGE_KEY, data: { products: INITIAL_PRODUCTS, whatsapp: DEFAULT_WHATSAPP, sales: [], banners: INITIAL_BANNERS } });
        }
      } catch (e) {
        console.error("Erro ao carregar catálogo do Supabase:", e);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const { error } = await supabase
          .from("moldeq_catalog")
          .upsert({ id: STORAGE_KEY, data: { products, whatsapp, sales, banners }, updated_at: new Date().toISOString() });
        if (error) throw error;
      } catch (e) {
        console.error("Erro ao salvar catálogo no Supabase:", e);
      }
    })();
  }, [products, whatsapp, sales, banners, loading]);

  function showToast(msg) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2200);
  }

  function addToCart(productId, colorName, sizeName, qty) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId && i.colorName === colorName && i.sizeName === sizeName);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { productId, colorName, sizeName, qty }];
    });
    setCartOpen(true);
  }

  function removeFromCart(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function changeQty(idx, delta) {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: Math.max(1, next[idx].qty + delta) };
      return next;
    });
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const visibleProducts = useMemo(() => {
    return products.filter((p) => p.active && p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const fontImport = (
    <style>{"@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');"}</style>
  );

  const pageBackground = {
    backgroundColor: PALETTE.bg,
    backgroundImage:
      "linear-gradient(rgba(20,22,28,0.94), rgba(20,22,28,0.94)), url(" + PATTERN_URI + ")",
    backgroundSize: "auto, 760px",
    backgroundRepeat: "no-repeat, repeat",
    backgroundPosition: "center, center",
    backgroundAttachment: "scroll, fixed",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", ...pageBackground, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {fontImport}
        <span style={{ color: PALETTE.muted, fontFamily: "Inter, sans-serif" }}>Carregando catálogo…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", ...pageBackground, fontFamily: "'Inter', sans-serif", color: PALETTE.text }}>
      {fontImport}

      <header style={{ borderBottom: "1px solid " + PALETTE.border, position: "sticky", top: 0, background: "rgba(20,22,28,0.92)", backdropFilter: "blur(6px)", zIndex: 30 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setView("shop")}>
            <img src={LOGO_URI} alt="Moldeq" style={{ height: 34 }} />
          </div>
          {view === "shop" && (
            <div style={{ flex: 1, maxWidth: 320, position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: PALETTE.muted }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                style={{
                  width: "100%",
                  background: PALETTE.surface,
                  border: "1px solid " + PALETTE.border,
                  borderRadius: 999,
                  color: PALETTE.text,
                  padding: "8px 12px 8px 32px",
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {view === "shop" && (
              <button
                onClick={() => setCartOpen(true)}
                style={{
                  position: "relative",
                  background: PALETTE.gold,
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 12px",
                  color: "#1A1204",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <ShoppingCart size={16} />
                {cartCount > 0 && (
                  <span style={{ background: "#1A1204", color: PALETTE.goldBright, borderRadius: 999, fontSize: 11, padding: "1px 6px" }}>{cartCount}</span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {view === "shop" ? (
        <>
          <BannerCarousel banners={banners} />
          <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 20px 30px", textAlign: "center" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: PALETTE.gold, marginBottom: 14 }}>
              Impressão 3D sob encomenda
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 5vw, 46px)", margin: "0 0 14px", lineHeight: 1.15 }}>
              Peças impressas, camada
              <br />
              por camada, do seu jeito.
            </h1>
            <p style={{ color: PALETTE.muted, maxWidth: 520, margin: "0 auto", fontSize: 15, lineHeight: 1.6 }}>
              Escolha o modelo, a cor e a quantidade. Seu pedido vai direto para o WhatsApp — sem burocracia, sem cadastro.
            </p>
          </section>

          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px" }}>
            <LayerLines height={22} opacity={0.55} />
          </div>

          <main id="catalogo" style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 20px 100px" }}>
            {visibleProducts.length === 0 ? (
              <p style={{ textAlign: "center", color: PALETTE.muted, marginTop: 60 }}>Nenhum produto encontrado para "{search}".</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
                {visibleProducts.map((p) => (
                  <ProductCard key={p.id} product={p} onAddToCart={addToCart} toast={showToast} />
                ))}
              </div>
            )}
          </main>

          <footer style={{ borderTop: "1px solid " + PALETTE.border, padding: "28px 20px 40px", textAlign: "center", color: PALETTE.muted, fontSize: 12, position: "relative" }}>
            Moldeq · Catálogo oficial de produtos 3D · Pedidos via WhatsApp
            <span
              onClick={() => setView("admin")}
              title=""
              style={{
                position: "absolute",
                right: 16,
                bottom: 6,
                fontSize: 9,
                color: "rgba(146,151,163,0.35)",
                cursor: "pointer",
                userSelect: "none",
                letterSpacing: "0.02em",
              }}
            >
              v1.0.3
            </span>
          </footer>

          <CartDrawer
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            cart={cart}
            products={products}
            onRemove={removeFromCart}
            onQtyChange={changeQty}
            whatsapp={whatsapp}
            note={note}
            setNote={setNote}
            onSent={() => {
              showToast("Pedido aberto no WhatsApp!");
            }}
          />

          {!cartOpen && (
            <button
              onClick={() => setCartOpen(true)}
              style={{
                position: "fixed",
                bottom: 22,
                right: 22,
                background: "linear-gradient(135deg," + PALETTE.gold + "," + PALETTE.goldBright + ")",
                border: "none",
                borderRadius: 999,
                width: 56,
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                zIndex: 20,
              }}
            >
              <ShoppingCart size={22} color="#1A1204" />
              {cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: PALETTE.purpleDeep,
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 11,
                    padding: "2px 6px",
                    fontWeight: 700,
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </>
      ) : (
        <AdminPanel products={products} setProducts={setProducts} whatsapp={whatsapp} setWhatsapp={setWhatsapp} sales={sales} setSales={setSales} banners={banners} setBanners={setBanners} onExit={() => setView("shop")} />
      )}

      <Toast message={toastMsg} />
    </div>
  );
}
