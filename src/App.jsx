import { useState, useEffect, useRef, useMemo, Component } from "react";
import { ShoppingCart, X, Plus, Minus, Trash2, Pencil, Lock, ImagePlus, Check, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search, Settings, PackagePlus, Film, Ruler, TrendingUp, Package, ClipboardList, Megaphone, Image as ImageIcon, Star, Truck, ShieldCheck, MessageCircle, Award, Clock, Calculator, Info, User, LogOut, Eye, EyeOff, PackageCheck, LayoutGrid, Sparkles, DollarSign, Percent, Gift, ThumbsUp, Phone, MapPin } from "lucide-react";
import { supabase } from "./supabaseClient";
import { INITIAL_PRODUCTS, LOGO_URI, PATTERN_URI, INITIAL_BANNERS, INITIAL_BENEFITS, INITIAL_CATEGORIES, INITIAL_HERO_CONTENT, INITIAL_PRICING_SETTINGS, DEFAULT_WHATSAPP, ADMIN_PIN, ADMIN_ACCESS_KEY, STORAGE_KEY } from "./data";

function formatBRL(v) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

function uid() {
  return "p" + Math.random().toString(36).slice(2, 9);
}

function buildWhatsAppMessage(cart, products, note, customerName) {
  const lines = [
    customerName
      ? "Olá! Meu nome é " + customerName + ". Vim pelo site da Moldeq e gostaria de fazer o seguinte pedido:"
      : "Olá! Vim pelo site da Moldeq e gostaria de fazer o seguinte pedido:",
    "",
  ];
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

const STORAGE_BUCKET = "product-images";

function dataUriToBlob(dataUri) {
  const [header, base64] = dataUri.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadBlobToStorage(blob, folder, extension = "jpg", contentType = "image/jpeg") {
  const path = folder + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 9) + "." + extension;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extensionForMime(mime) {
  if (!mime) return "jpg";
  if (mime.startsWith("video/")) return mime.split("/")[1] || "mp4";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

async function uploadDataUriToStorage(dataUri, folder) {
  const blob = dataUriToBlob(dataUri);
  const ext = extensionForMime(blob.type);
  return uploadBlobToStorage(blob, folder, ext, blob.type || "image/jpeg");
}

async function uploadVideoToStorage(file) {
  const nameExt = file.name && file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
  const typeExt = file.type && file.type.includes("/") ? file.type.split("/")[1] : "";
  const ext = nameExt || typeExt || "mp4";
  return uploadBlobToStorage(file, "videos", ext, file.type || "video/mp4");
}

// Standard product photo format: square canvas (1:1), fixed pixel size.
// The photo is scaled to fit fully inside the square (nothing gets cropped) and
// centered on a white background, matching a consistent catalog look. The result
// is uploaded to Supabase Storage and only the (small) public URL is kept in the
// catalog data, so the site stays fast and light even with 50+ products.
const PRODUCT_PHOTO_SIZE = 1200;

function compressSquareImageBlob(file, targetSize = PRODUCT_PHOTO_SIZE, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetSize, targetSize);
        const scale = Math.min(targetSize / img.width, targetSize / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const dx = (targetSize - drawWidth) / 2;
        const dy = (targetSize - drawHeight) / 2;
        ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Falha ao gerar imagem"));
          },
          "image/jpeg",
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function compressWideImageBlob(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Falha ao gerar imagem"));
          },
          "image/jpeg",
          quality
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressAndUploadProductPhoto(file) {
  const blob = await compressSquareImageBlob(file);
  return uploadBlobToStorage(blob, "products");
}

async function compressAndUploadColorPhoto(file) {
  const blob = await compressSquareImageBlob(file);
  return uploadBlobToStorage(blob, "colors");
}

async function compressAndUploadBannerPhoto(file) {
  const blob = await compressWideImageBlob(file);
  return uploadBlobToStorage(blob, "banners");
}

async function listStorageFiles(folder) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(folder, { limit: 500, sortBy: { column: "name", order: "desc" } });
  if (error) throw error;
  return (data || [])
    .filter((f) => f && f.name && f.id)
    .map((f) => ({
      name: f.name,
      url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(folder + "/" + f.name).data.publicUrl,
    }));
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// One-time migration: older photos saved directly as base64 (before Storage was
// added) get uploaded to Supabase Storage in the background, replacing the huge
// embedded text with a small URL. Anything that fails is left untouched so no
// photo is ever lost.
async function migrateBase64ToStorage(products, banners) {
  async function migrateProduct(p) {
    const newMedia = [];
    for (const m of p.media || []) {
      if (typeof m.url === "string" && m.url.startsWith("data:")) {
        try {
          const url = await uploadDataUriToStorage(m.url, m.type === "video" ? "videos" : "products");
          newMedia.push({ ...m, url });
        } catch (e) {
          newMedia.push(m);
        }
      } else {
        newMedia.push(m);
      }
    }
    const newColors = [];
    for (const c of p.colors || []) {
      if (c.image && typeof c.image === "string" && c.image.startsWith("data:")) {
        try {
          const url = await uploadDataUriToStorage(c.image, "colors");
          newColors.push({ ...c, image: url });
        } catch (e) {
          newColors.push(c);
        }
      } else {
        newColors.push(c);
      }
    }
    return { ...p, media: newMedia, colors: newColors };
  }

  const newProducts = await mapWithConcurrency(products, 4, migrateProduct);

  const newBanners = [];
  for (const b of banners) {
    if (b.image && typeof b.image === "string" && b.image.startsWith("data:")) {
      try {
        const url = await uploadDataUriToStorage(b.image, "banners");
        newBanners.push({ ...b, image: url });
      } catch (e) {
        newBanners.push(b);
      }
    } else {
      newBanners.push(b);
    }
  }

  return { products: newProducts, banners: newBanners };
}

function hasLegacyBase64Images(products, banners) {
  const inProducts = (products || []).some(
    (p) => (p.media || []).some((m) => typeof m.url === "string" && m.url.startsWith("data:")) || (p.colors || []).some((c) => c.image && String(c.image).startsWith("data:"))
  );
  const inBanners = (banners || []).some((b) => b.image && String(b.image).startsWith("data:"));
  return inProducts || inBanners;
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
  discount: "#E8734A",
};

function PriceDisplay({ price, originalPrice, priceFrom, size = "normal" }) {
  const hasDiscount = originalPrice && originalPrice > price;
  const percentOff = hasDiscount ? Math.round((1 - price / originalPrice) * 100) : 0;
  const bigSize = size === "large" ? 26 : size === "small" ? 15 : 19;
  const smallSize = size === "large" ? 15 : size === "small" ? 11 : 13;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: bigSize, color: PALETTE.goldBright }}>
        {priceFrom ? "a partir de " : ""}
        {formatBRL(price)}
      </span>
      {hasDiscount && (
        <>
          <span style={{ fontSize: smallSize, color: PALETTE.muted, textDecoration: "line-through" }}>{formatBRL(originalPrice)}</span>
          <span
            style={{
              fontSize: smallSize - 1,
              fontWeight: 700,
              color: PALETTE.discount,
              background: "rgba(232,115,74,0.15)",
              padding: "2px 7px",
              borderRadius: 6,
            }}
          >
            -{percentOff}%
          </span>
        </>
      )}
    </div>
  );
}

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

function MediaViewer({ gallery, height = "auto", lazy = true }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [gallery.length > 0 ? gallery[0].url : null]);

  if (!gallery || gallery.length === 0) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: PALETTE.surface }}>
        <Package size={28} color={PALETTE.muted} />
      </div>
    );
  }

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
          loading={lazy ? "lazy" : "eager"}
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

function useProductVariant(product) {
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

  const media = product.media && product.media.length > 0 ? product.media : [];
  const gallery = selectedColor && selectedColor.image ? [{ type: "image", url: selectedColor.image }, ...media.filter((m) => m.url !== selectedColor.image)] : media;

  return { colorName, setColorName, sizeName, setSizeName, qty, setQty, selectedColor, selectedSize, hasColors, hasSizes, outOfStock, maxQty, gallery };
}

function StarRating({ rating = 0, size = 13, count, showCount = true }) {
  if (!rating || rating <= 0) return null;
  const stars = [0, 1, 2, 3, 4];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ display: "flex", gap: 1 }}>
        {stars.map((i) => {
          const fill = Math.max(0, Math.min(1, rating - i));
          return (
            <span key={i} style={{ position: "relative", width: size, height: size, display: "inline-block", flexShrink: 0 }}>
              <Star size={size} color={PALETTE.border} style={{ position: "absolute", top: 0, left: 0 }} />
              <span style={{ position: "absolute", top: 0, left: 0, width: fill * 100 + "%", height: "100%", overflow: "hidden" }}>
                <Star size={size} color={PALETTE.gold} fill={PALETTE.gold} style={{ display: "block" }} />
              </span>
            </span>
          );
        })}
      </div>
      {showCount && count > 0 && <span style={{ fontSize: 11, color: PALETTE.muted }}>({count})</span>}
    </div>
  );
}

function ProductCard({ product, onAddToCart, onOpenProduct, toast }) {
  const v = useProductVariant(product);
  const { colorName, setColorName, sizeName, setSizeName, qty, setQty, hasColors, hasSizes, outOfStock, maxQty, gallery } = v;

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
      <div
        onClick={() => onOpenProduct(product.id)}
        style={{ position: "relative", aspectRatio: "1/1", background: PALETTE.surface, cursor: "pointer" }}
      >
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
      <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div>
          <h3
            onClick={() => onOpenProduct(product.id)}
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
              cursor: "pointer",
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

        <div style={{ minHeight: 16 }}>
          <StarRating rating={product.rating} count={product.reviewCount} size={12} />
        </div>

        <div style={{ minHeight: 24 }}>
          <PriceDisplay price={product.price} originalPrice={product.originalPrice} priceFrom={product.priceFrom} />
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

function CartDrawer({ open, onClose, cart, products, onRemove, onQtyChange, whatsapp, note, setNote, onSent, customerName }) {
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
                const thumb = (p.media && p.media[0] && p.media[0].url) || "";
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
              href={"https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(buildWhatsAppMessage(cart, products, note, customerName))}
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

const BENEFIT_ICONS = {
  truck: Truck,
  shield: ShieldCheck,
  message: MessageCircle,
  award: Award,
  clock: Clock,
  package: Package,
  money: DollarSign,
  percent: Percent,
  gift: Gift,
  thumbsup: ThumbsUp,
  phone: Phone,
  pin: MapPin,
  star: Star,
};

function BenefitsStrip({ benefits }) {
  const active = (benefits || []).filter((b) => b.active !== false && b.text);
  if (active.length === 0) return null;
  return (
    <div style={{ maxWidth: 1100, margin: "18px auto 0", padding: "0 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {active.map((b) => {
          const Icon = BENEFIT_ICONS[b.icon] || Truck;
          return (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: PALETTE.surface,
                border: "1px solid " + PALETTE.border,
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <Icon size={18} color={PALETTE.gold} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: PALETTE.text, lineHeight: 1.3 }}>{b.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const railArrowStyle = {
  background: PALETTE.surface,
  border: "1px solid " + PALETTE.border,
  borderRadius: 8,
  color: PALETTE.text,
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

function ProductRail({ title, products, onOpenProduct }) {
  const scrollRef = useRef(null);
  if (!products || products.length === 0) return null;

  function scrollByAmount(dir) {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: PALETTE.text }}>{title}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => scrollByAmount(-1)} style={railArrowStyle}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => scrollByAmount(1)} style={railArrowStyle}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory" }}>
        {products.map((p) => (
          <div
            key={p.id}
            onClick={() => onOpenProduct(p.id)}
            style={{
              minWidth: 190,
              maxWidth: 190,
              scrollSnapAlign: "start",
              cursor: "pointer",
              background: PALETTE.surface,
              border: "1px solid " + PALETTE.border,
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div style={{ aspectRatio: "1/1", background: PALETTE.surface2 }}>
              <img
                src={(p.media && p.media[0] && p.media[0].url) || LOGO_URI}
                alt={p.name}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6%", boxSizing: "border-box", display: "block" }}
              />
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: PALETTE.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
              <div style={{ marginTop: 5, minHeight: 14 }}>
                <StarRating rating={p.rating} count={p.reviewCount} size={11} />
              </div>
              <div style={{ marginTop: 5 }}>
                <PriceDisplay price={p.price} originalPrice={p.originalPrice} priceFrom={p.priceFrom} size="small" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function translateAuthError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("user already registered") || m.includes("already registered")) return "Esse e-mail já tem uma conta. Tente entrar em vez de criar uma nova.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Digite um e-mail válido.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).";
  if (m.includes("rate limit")) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  return "Não foi possível completar a ação. Tente novamente.";
}

function AuthModal({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    onAuthenticated();
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!name.trim()) {
      setError("Digite seu nome.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), phone: phone.trim() } },
    });
    if (error) {
      setLoading(false);
      setError(translateAuthError(error.message));
      return;
    }
    if (data.user) {
      try {
        await supabase.from("profiles").upsert({ id: data.user.id, name: name.trim(), phone: phone.trim() });
      } catch (e) {}
    }
    setLoading(false);
    if (data.session) {
      onAuthenticated();
    } else {
      setInfo("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
      setMode("login");
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Digite seu e-mail primeiro.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      setError(translateAuthError(error.message));
      return;
    }
    setInfo("Enviamos um link de redefinição de senha para o seu e-mail.");
  }

  const inputStyle = {
    width: "100%",
    marginTop: 4,
    background: PALETTE.surface2,
    border: "1px solid " + PALETTE.border,
    borderRadius: 8,
    color: PALETTE.text,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,9,12,0.65)", zIndex: 60 }} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(380px, 92vw)",
          background: PALETTE.bg2,
          border: "1px solid " + PALETTE.border,
          borderRadius: 16,
          padding: 24,
          zIndex: 61,
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: PALETTE.text }}>
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {mode !== "reset" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 18, background: PALETTE.surface, borderRadius: 10, padding: 4 }}>
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setInfo("");
              }}
              style={{
                flex: 1,
                background: mode === "login" ? PALETTE.gold : "transparent",
                color: mode === "login" ? "#1A1204" : PALETTE.muted,
                border: "none",
                borderRadius: 8,
                padding: "8px 0",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError("");
                setInfo("");
              }}
              style={{
                flex: 1,
                background: mode === "signup" ? PALETTE.gold : "transparent",
                color: mode === "signup" ? "#1A1204" : PALETTE.muted,
                border: "none",
                borderRadius: 8,
                padding: "8px 0",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Criar conta
            </button>
          </div>
        )}

        <form onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <>
              <label style={{ fontSize: 12, color: PALETTE.muted }}>
                Nome
                <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
              </label>
              <label style={{ fontSize: 12, color: PALETTE.muted }}>
                Telefone (opcional)
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" style={inputStyle} />
              </label>
            </>
          )}
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
          </label>
          {mode !== "reset" && (
            <label style={{ fontSize: 12, color: PALETTE.muted }}>
              Senha
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required minLength={6} />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{ position: "absolute", right: 8, top: 8, background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          )}

          {error && <p style={{ fontSize: 12, color: PALETTE.danger, margin: 0 }}>{error}</p>}
          {info && <p style={{ fontSize: 12, color: PALETTE.gold, margin: 0 }}>{info}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: PALETTE.gold,
              color: "#1A1204",
              border: "none",
              borderRadius: 10,
              padding: "12px 0",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "Um instante..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link de redefinição"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError("");
                setInfo("");
              }}
              style={{ background: "transparent", border: "none", color: PALETTE.muted, fontSize: 12, cursor: "pointer", textAlign: "center" }}
            >
              Esqueci minha senha
            </button>
          )}
          {mode === "reset" && (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setInfo("");
              }}
              style={{ background: "transparent", border: "none", color: PALETTE.muted, fontSize: 12, cursor: "pointer", textAlign: "center" }}
            >
              ← Voltar para entrar
            </button>
          )}
        </form>
      </div>
    </>
  );
}

function AccountMenu({ user, profile, onOpenAuth, onLogout, onOpenOrders }) {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <button
        onClick={onOpenAuth}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, borderRadius: 8, padding: "8px 12px", color: PALETTE.text, cursor: "pointer", fontSize: 13 }}
      >
        <User size={15} /> Entrar
      </button>
    );
  }

  const firstName = profile && profile.name ? profile.name.split(" ")[0] : "Conta";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, borderRadius: 8, padding: "8px 12px", color: PALETTE.text, cursor: "pointer", fontSize: 13, maxWidth: 130 }}
      >
        <User size={15} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              background: PALETTE.surface2,
              border: "1px solid " + PALETTE.border,
              borderRadius: 10,
              minWidth: 170,
              zIndex: 30,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <button
              onClick={() => {
                setOpen(false);
                onOpenOrders();
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: PALETTE.text, padding: "10px 14px", fontSize: 13, cursor: "pointer", textAlign: "left" }}
            >
              <PackageCheck size={14} /> Meus pedidos
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: PALETTE.danger, padding: "10px 14px", fontSize: 13, cursor: "pointer", textAlign: "left", borderTop: "1px solid " + PALETTE.border }}
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function OrdersPage({ user, onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        setOrders(data || []);
      } catch (e) {
        console.error("Erro ao carregar pedidos:", e);
        setLoadFailed(true);
      }
      setLoading(false);
    })();
  }, [user.id]);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px 80px" }}>
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer", fontSize: 13, marginBottom: 18, padding: 0 }}
      >
        <ChevronLeft size={15} /> Voltar ao catálogo
      </button>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, color: PALETTE.text, margin: "0 0 18px" }}>Meus pedidos</h1>

      {loading ? (
        <p style={{ color: PALETTE.muted, fontSize: 14 }}>Carregando...</p>
      ) : loadFailed ? (
        <p style={{ color: PALETTE.danger, fontSize: 14 }}>Não consegui carregar seu histórico agora (falha de conexão). Tente recarregar a página em instantes.</p>
      ) : orders.length === 0 ? (
        <p style={{ color: PALETTE.muted, fontSize: 14 }}>Você ainda não fez nenhum pedido por aqui.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {orders.map((o) => (
            <div key={o.id} style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 12, color: PALETTE.muted }}>{formatDatePt(o.created_at)}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: PALETTE.goldBright, fontFamily: "'Space Grotesk', sans-serif" }}>{formatBRL(o.total)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(o.items || []).map((it, i) => (
                  <div key={i} style={{ fontSize: 13, color: PALETTE.text }}>
                    • {it.name}
                    {it.colorName ? " — " + it.colorName : ""}
                    {it.sizeName ? " — " + it.sizeName : ""} — qtd {it.qty}
                  </div>
                ))}
              </div>
              {o.note && <p style={{ fontSize: 12, color: PALETTE.muted, marginTop: 8, marginBottom: 0 }}>Obs: {o.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDetailPage({ product, allProducts, onAddToCart, onBack, onOpenProduct, toast }) {
  const v = useProductVariant(product);
  const { colorName, setColorName, sizeName, setSizeName, qty, setQty, hasColors, hasSizes, outOfStock, maxQty, gallery } = v;
  const related = allProducts.filter((p) => p.id !== product.id && p.active).slice(0, 10);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px" }}>
      <button
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer", fontSize: 13, marginBottom: 18, padding: 0 }}
      >
        <ChevronLeft size={15} /> Voltar ao catálogo
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 36 }}>
        <div>
          <div style={{ position: "relative", aspectRatio: "1/1", background: PALETTE.surface, borderRadius: 16, overflow: "hidden", border: "1px solid " + PALETTE.border }}>
            <MediaViewer gallery={gallery} lazy={false} />
          </div>
          {gallery.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {gallery.map((m, i) => (
                <div key={i} style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", border: "1px solid " + PALETTE.border, background: PALETTE.surface, flexShrink: 0 }}>
                  {m.type === "video" ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Film size={16} color={PALETTE.gold} />
                    </div>
                  ) : (
                    <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4, boxSizing: "border-box" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: PALETTE.text, lineHeight: 1.25 }}>{product.name}</h1>
          <div style={{ marginTop: 10, minHeight: 18 }}>
            <StarRating rating={product.rating} count={product.reviewCount} size={15} />
          </div>
          <div style={{ marginTop: 14 }}>
            <PriceDisplay price={product.price} originalPrice={product.originalPrice} priceFrom={product.priceFrom} size="large" />
          </div>
          <p style={{ marginTop: 14, fontSize: 14, color: PALETTE.muted, lineHeight: 1.6 }}>{product.description}</p>

          {hasColors && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 8 }}>
                Cor: <span style={{ color: PALETTE.text, fontWeight: 600 }}>{colorName}</span>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {product.colors.map((c) => (
                  <ColorSwatch key={c.name} color={c} selected={colorName === c.name} disabled={c.stock <= 0} onClick={() => setColorName(c.name)} />
                ))}
              </div>
            </div>
          )}

          {hasSizes && (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 8 }}>
                Tamanho: <span style={{ color: PALETTE.text, fontWeight: 600 }}>{sizeName}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.sizes.map((s) => (
                  <SizeButton key={s.name} size={s} selected={sizeName === s.name} disabled={s.stock <= 0} onClick={() => setSizeName(s.name)} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid " + PALETTE.border, borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={outOfStock}
                style={{ background: "transparent", border: "none", color: PALETTE.text, padding: "10px 14px", cursor: "pointer" }}
              >
                <Minus size={15} />
              </button>
              <span style={{ minWidth: 26, textAlign: "center", fontSize: 15, color: PALETTE.text }}>{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))}
                disabled={outOfStock}
                style={{ background: "transparent", border: "none", color: PALETTE.text, padding: "10px 14px", cursor: "pointer" }}
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              disabled={outOfStock}
              onClick={() => {
                onAddToCart(product.id, colorName, sizeName, qty);
                toast(product.name + " adicionado ao carrinho");
              }}
              style={{
                flex: 1,
                minWidth: 200,
                background: outOfStock ? "rgba(217,164,76,0.15)" : "linear-gradient(135deg," + PALETTE.gold + "," + PALETTE.goldBright + ")",
                color: outOfStock ? PALETTE.muted : "#1A1204",
                border: "none",
                borderRadius: 10,
                padding: "13px 16px",
                fontWeight: 700,
                fontSize: 14,
                cursor: outOfStock ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ShoppingCart size={16} /> {outOfStock ? "Indisponível" : "Adicionar ao carrinho"}
            </button>
          </div>
        </div>
      </div>

      <ProductRail title="Produtos relacionados" products={related} onOpenProduct={onOpenProduct} />
    </div>
  );
}

function MediaLibraryPicker({ folder, onSelect, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await listStorageFiles(folder);
        setFiles(list);
      } catch (e) {
        console.error(e);
        setError("Não consegui listar as fotos já enviadas. Tente de novo em instantes.");
      }
      setLoading(false);
    })();
  }, [folder]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,9,12,0.7)", zIndex: 70 }} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(720px, 92vw)",
          maxHeight: "82vh",
          overflowY: "auto",
          background: PALETTE.bg2,
          border: "1px solid " + PALETTE.border,
          borderRadius: 16,
          padding: 20,
          zIndex: 71,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", color: PALETTE.text, fontSize: 16 }}>Fotos já enviadas</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: PALETTE.muted, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: PALETTE.muted, marginTop: 0, marginBottom: 16 }}>
          Fotos que já existem no seu Storage, mesmo que não estejam ligadas a nenhum produto agora. Útil para reaproveitar imagens.
        </p>
        {loading ? (
          <p style={{ color: PALETTE.muted, fontSize: 13 }}>Carregando...</p>
        ) : error ? (
          <p style={{ color: PALETTE.danger, fontSize: 13 }}>{error}</p>
        ) : files.length === 0 ? (
          <p style={{ color: PALETTE.muted, fontSize: 13 }}>Nenhuma foto encontrada nessa pasta.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
            {files.map((f) => (
              <button
                key={f.name}
                onClick={() => onSelect(f.url)}
                title={f.name}
                style={{
                  padding: 0,
                  border: "1px solid " + PALETTE.border,
                  borderRadius: 8,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: PALETTE.surface,
                  aspectRatio: "1/1",
                }}
              >
                <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AdminProductForm({ product, categories, onSave, onCancel, onDelete }) {
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
  const [uploading, setUploading] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState(null);

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
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        const url = await compressAndUploadProductPhoto(f);
        urls.push(url);
      }
      setForm((f) => ({ ...f, media: [...f.media, ...urls.map((u) => ({ type: "image", url: u }))] }));
    } catch (err) {
      console.error(err);
      alert("Não consegui enviar uma das fotos. Verifique sua internet e tente de novo.");
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleVideoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("Esse vídeo tem mais de 20MB. Prefira colar um link (YouTube ou .mp4 já hospedado) para o site carregar mais rápido.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const url = await uploadVideoToStorage(file);
      setForm((f) => ({ ...f, media: [...f.media, { type: "video", url }] }));
    } catch (err) {
      console.error(err);
      alert("Não consegui enviar o vídeo. Verifique sua internet e tente de novo.");
    }
    setUploading(false);
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
    setUploading(true);
    try {
      const url = await compressAndUploadColorPhoto(file);
      updateColor(idx, "image", url);
    } catch (err) {
      console.error(err);
      alert("Não consegui enviar essa foto. Verifique sua internet e tente de novo.");
    }
    setUploading(false);
    e.target.value = "";
  }

  function handleLibrarySelect(url) {
    if (libraryTarget === "media") {
      setForm((f) => ({ ...f, media: [...f.media, { type: "image", url }] }));
    } else if (libraryTarget && libraryTarget.startsWith("color:")) {
      const idx = Number(libraryTarget.split(":")[1]);
      updateColor(idx, "image", url);
    }
    setLibraryTarget(null);
  }

  return (
    <>
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
            disabled={uploading}
            onClick={() => photoInputRef.current && photoInputRef.current.click()}
            style={{ width: 84, height: 84, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "transparent", border: "1px dashed " + PALETTE.border, borderRadius: 8, color: PALETTE.muted, cursor: uploading ? "wait" : "pointer", fontSize: 11 }}
          >
            <ImagePlus size={16} /> {uploading ? "Otimizando..." : "Fotos"}
          </button>
          <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotosUpload} style={{ display: "none" }} />
          <button
            type="button"
            onClick={() => setLibraryTarget("media")}
            style={{ width: 84, height: 84, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "transparent", border: "1px dashed " + PALETTE.border, borderRadius: 8, color: PALETTE.muted, cursor: "pointer", fontSize: 10, textAlign: "center", padding: 4 }}
          >
            <ClipboardList size={16} /> Já enviadas
          </button>
        </div>
        <p style={{ fontSize: 11, color: PALETTE.muted, marginTop: 8 }}>
          As fotos são padronizadas automaticamente para {PRODUCT_PHOTO_SIZE}x{PRODUCT_PHOTO_SIZE}px (quadradas), sem cortar nada da imagem original — isso deixa o catálogo com visual uniforme e carrega mais rápido.
        </p>
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
        <label style={{ fontSize: 12, color: PALETTE.muted }}>
          Categoria (usada no filtro da loja)
          <select
            value={form.category || ""}
            onChange={(e) => updateField("category", e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
          >
            <option value="">Sem categoria</option>
            {(categories || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Preço original (opcional, mostra desconto)
            <input
              type="number"
              step="0.01"
              value={form.originalPrice || ""}
              onChange={(e) => updateField("originalPrice", e.target.value === "" ? 0 : Number(e.target.value))}
              placeholder="Ex: 119,90"
              style={{ display: "block", marginTop: 4, width: 150, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
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
          <label style={{ fontSize: 12, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 20 }}>
            <input type="checkbox" checked={!!form.featured} onChange={(e) => updateField("featured", e.target.checked)} />
            Mostrar no carrossel de destaques
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Avaliação (0 a 5)
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={form.rating || 0}
              onChange={(e) => updateField("rating", Math.max(0, Math.min(5, Number(e.target.value))))}
              style={{ display: "block", marginTop: 4, width: 90, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Nº de avaliações
            <input
              type="number"
              min="0"
              value={form.reviewCount || 0}
              onChange={(e) => updateField("reviewCount", Math.max(0, Number(e.target.value)))}
              style={{ display: "block", marginTop: 4, width: 100, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <p style={{ fontSize: 11, color: PALETTE.muted, alignSelf: "flex-end", marginBottom: 8, maxWidth: 260 }}>
            A avaliação é decorativa (definida por você aqui), já que o site ainda não coleta avaliações reais de clientes.
          </p>
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
              {!c.image && (
                <button
                  type="button"
                  onClick={() => setLibraryTarget("color:" + idx)}
                  title="Escolher de fotos já enviadas"
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px dashed " + PALETTE.border, color: PALETTE.muted, borderRadius: 8, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
                >
                  <ClipboardList size={12} /> Já enviada
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
    {libraryTarget && (
      <MediaLibraryPicker folder={libraryTarget === "media" ? "products" : "colors"} onSelect={handleLibrarySelect} onClose={() => setLibraryTarget(null)} />
    )}
    </>
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
  const [uploadingId, setUploadingId] = useState(null);
  const [libraryTargetId, setLibraryTargetId] = useState(null);

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
    setUploadingId(id);
    try {
      const url = await compressAndUploadBannerPhoto(file);
      updateBanner(id, "image", url);
    } catch (err) {
      console.error(err);
      alert("Não consegui enviar essa imagem. Verifique sua internet e tente de novo.");
    }
    setUploadingId(null);
    e.target.value = "";
  }

  function handleLibrarySelect(url) {
    if (libraryTargetId) {
      updateBanner(libraryTargetId, "image", url);
    }
    setLibraryTargetId(null);
  }

  return (
    <>
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
                    disabled={uploadingId === b.id}
                    onClick={() => fileInputRefs.current[b.id] && fileInputRefs.current[b.id].click()}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.text, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: uploadingId === b.id ? "wait" : "pointer" }}
                  >
                    <ImageIcon size={13} /> {uploadingId === b.id ? "Enviando..." : "Trocar imagem"}
                  </button>
                  <input ref={(el) => (fileInputRefs.current[b.id] = el)} type="file" accept="image/*" onChange={(e) => handleImage(b.id, e)} style={{ display: "none" }} />
                  <button
                    type="button"
                    onClick={() => setLibraryTargetId(b.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px dashed " + PALETTE.border, color: PALETTE.muted, borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}
                  >
                    <ClipboardList size={13} /> Já enviada
                  </button>
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
    {libraryTargetId && <MediaLibraryPicker folder="banners" onSelect={handleLibrarySelect} onClose={() => setLibraryTargetId(null)} />}
    </>
  );
}

function AdminBenefits({ benefits, setBenefits }) {
  function updateBenefit(id, field, value) {
    setBenefits((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  function addBenefit() {
    setBenefits((prev) => [...prev, { id: uid(), icon: "truck", text: "Novo benefício", active: true }]);
  }

  function removeBenefit(id) {
    setBenefits((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={16} color={PALETTE.gold} />
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Faixa de benefícios</h3>
        </div>
        <button
          onClick={addBenefit}
          style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={14} /> Novo item
        </button>
      </div>
      <p style={{ fontSize: 12, color: PALETTE.muted, marginTop: -8, marginBottom: 14 }}>Aparece como uma fileira de ícones logo abaixo do banner principal.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {benefits.map((b) => {
          const Icon = BENEFIT_ICONS[b.icon] || Truck;
          return (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 10, padding: 10, flexWrap: "wrap" }}>
              <Icon size={18} color={PALETTE.gold} style={{ flexShrink: 0 }} />
              <select
                value={b.icon}
                onChange={(e) => updateBenefit(b.id, "icon", e.target.value)}
                style={{ background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "6px 8px", fontSize: 12 }}
              >
                <option value="truck">Caminhão</option>
                <option value="shield">Escudo</option>
                <option value="message">Mensagem</option>
                <option value="award">Selo</option>
                <option value="clock">Relógio</option>
                <option value="package">Caixa</option>
                <option value="money">Cifrão</option>
                <option value="percent">Porcentagem</option>
                <option value="gift">Presente</option>
                <option value="thumbsup">Joinha</option>
                <option value="phone">Telefone</option>
                <option value="pin">Localização</option>
                <option value="star">Estrela</option>
              </select>
              <input
                value={b.text}
                onChange={(e) => updateBenefit(b.id, "text", e.target.value)}
                style={{ flex: 1, minWidth: 180, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "7px 10px", fontSize: 13 }}
              />
              <label style={{ fontSize: 11, color: PALETTE.muted, display: "flex", alignItems: "center", gap: 5 }}>
                <input type="checkbox" checked={b.active !== false} onChange={(e) => updateBenefit(b.id, "active", e.target.checked)} />
                Ativo
              </label>
              <button onClick={() => removeBenefit(b.id)} style={{ background: "transparent", border: "none", color: PALETTE.danger, cursor: "pointer" }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryFilter({ categories, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  if (!categories || categories.length === 0) return null;

  const label = selected || "Categorias";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: PALETTE.surface,
          border: "1px solid " + PALETTE.border,
          borderRadius: 999,
          padding: "8px 14px",
          color: PALETTE.text,
          cursor: "pointer",
          fontSize: 13,
          whiteSpace: "nowrap",
        }}
      >
        <LayoutGrid size={14} color={PALETTE.gold} />
        {label}
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "calc(100% + 6px)",
              background: PALETTE.surface2,
              border: "1px solid " + PALETTE.border,
              borderRadius: 10,
              minWidth: 200,
              zIndex: 30,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            <button
              onClick={() => {
                onSelect("");
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: !selected ? PALETTE.surface : "transparent",
                border: "none",
                color: PALETTE.text,
                padding: "10px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Todas as categorias
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: selected === c ? PALETTE.surface : "transparent",
                  border: "none",
                  borderTop: "1px solid " + PALETTE.border,
                  color: PALETTE.text,
                  padding: "10px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomOrderButton({ whatsapp }) {
  const message = "Olá! Gostaria de saber sobre a possibilidade de fazer uma peça personalizada/sob encomenda.";
  return (
    <a
      href={"https://wa.me/" + whatsapp + "?text=" + encodeURIComponent(message)}
      target="_blank"
      rel="noopener noreferrer"
      title="Pedir peça personalizada"
      style={{
        position: "fixed",
        bottom: 90,
        right: 22,
        background: "#25D366",
        border: "none",
        borderRadius: 999,
        width: 48,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        zIndex: 19,
        textDecoration: "none",
      }}
    >
      <Sparkles size={20} color="#0A2E1A" />
    </a>
  );
}

function AdminCategories({ categories, setCategories, products }) {
  const [draft, setDraft] = useState("");

  function addCategory() {
    const name = draft.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    setCategories((prev) => [...prev, name]);
    setDraft("");
  }

  function removeCategory(name) {
    const inUse = (products || []).filter((p) => p.category === name).length;
    if (inUse > 0 && !window.confirm(inUse + " produto(s) usam essa categoria e vão ficar sem categoria. Remover mesmo assim?")) return;
    setCategories((prev) => prev.filter((c) => c !== name));
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <LayoutGrid size={16} color={PALETTE.gold} />
        <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Categorias</h3>
      </div>
      <p style={{ fontSize: 12, color: PALETTE.muted, marginTop: 0, marginBottom: 14 }}>
        Controla o filtro "Categorias" da loja e a lista que aparece na edição de cada produto.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, maxWidth: 420 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCategory();
            }
          }}
          placeholder="Nova categoria (ex: Utilidades)"
          style={{ flex: 1, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
        />
        <button
          onClick={addCategory}
          style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {categories.length === 0 ? (
        <p style={{ fontSize: 12, color: PALETTE.muted }}>Nenhuma categoria cadastrada ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
          {categories.map((c) => (
            <div key={c} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontSize: 13, color: PALETTE.text }}>{c}</span>
              <button onClick={() => removeCategory(c)} style={{ background: "transparent", border: "none", color: PALETTE.danger, cursor: "pointer" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminHeroText({ heroContent, setHeroContent }) {
  const [draft, setDraft] = useState(heroContent);

  function update(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  function save() {
    setHeroContent(draft);
  }

  function reset() {
    setDraft(INITIAL_HERO_CONTENT);
    setHeroContent(INITIAL_HERO_CONTENT);
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Pencil size={16} color={PALETTE.gold} />
        <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Texto de destaque (topo da página)</h3>
      </div>
      <p style={{ fontSize: 12, color: PALETTE.muted, marginTop: 0, marginBottom: 14 }}>
        Aparece logo abaixo do banner: a fraseinha pequena, o título grande e a linha de apoio.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
        <label style={{ fontSize: 12, color: PALETTE.muted }}>
          Frase pequena (acima do título)
          <input
            value={draft.eyebrow}
            onChange={(e) => update("eyebrow", e.target.value)}
            style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}
          />
        </label>
        <label style={{ fontSize: 12, color: PALETTE.muted }}>
          Título grande (use uma linha em branco/Enter para quebrar a linha)
          <textarea
            value={draft.title}
            onChange={(e) => update("title", e.target.value)}
            rows={2}
            style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </label>
        <label style={{ fontSize: 12, color: PALETTE.muted }}>
          Linha de apoio (texto menor abaixo do título)
          <textarea
            value={draft.subtitle}
            onChange={(e) => update("subtitle", e.target.value)}
            rows={2}
            style={{ width: "100%", marginTop: 4, background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={save}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            <Check size={14} /> Salvar texto
          </button>
          <button onClick={reset} style={{ background: "transparent", border: "1px solid " + PALETTE.border, color: PALETTE.muted, borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>
            Restaurar padrão
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPricingCalculator({ products, setProducts, pricingSettings, setPricingSettings }) {
  const [settingsDraft, setSettingsDraft] = useState(pricingSettings);
  const [weight, setWeight] = useState(50);
  const [printHours, setPrintHours] = useState(3);
  const [laborMinutes, setLaborMinutes] = useState(15);
  const [extraMaterialsCost, setExtraMaterialsCost] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [customMargin, setCustomMargin] = useState(null);
  const [applyProductId, setApplyProductId] = useState(products[0] ? products[0].id : "");
  const [applyMsg, setApplyMsg] = useState("");

  function updateSetting(field, value) {
    setSettingsDraft((s) => ({ ...s, [field]: Math.max(0, Number(value) || 0) }));
  }

  function saveSettings() {
    setPricingSettings(settingsDraft);
  }

  const margin = customMargin !== null ? customMargin : settingsDraft.marginPercent;

  const filamentCost = (weight / 1000) * settingsDraft.filamentPricePerKg;
  const energyCost = (settingsDraft.printerWattage / 1000) * printHours * settingsDraft.energyPricePerKwh;
  const toolsCost = settingsDraft.toolsCostPerHour * printHours;
  const laborCost = (laborMinutes / 60) * settingsDraft.laborHourlyRate;
  const extraCost = Math.max(0, Number(extraMaterialsCost) || 0);
  const baseSubtotal = filamentCost + energyCost + toolsCost + laborCost + extraCost;
  const failureReserve = baseSubtotal * (settingsDraft.failureRatePercent / 100);
  const totalCost = baseSubtotal + failureReserve;
  const salePrice = totalCost * (1 + margin / 100);
  const profit = salePrice - totalCost;
  const qty = Math.max(1, Number(quantity) || 1);

  function applyToProduct() {
    if (!applyProductId) return;
    setProducts((prev) => prev.map((p) => (p.id === applyProductId ? { ...p, price: Math.round(salePrice * 100) / 100 } : p)));
    const p = products.find((pr) => pr.id === applyProductId);
    setApplyMsg("Preço de " + formatBRL(salePrice) + " aplicado a \"" + (p ? p.name : "") + "\".");
    setTimeout(() => setApplyMsg(""), 3500);
  }

  const row = { display: "flex", justifyContent: "space-between", fontSize: 13, color: PALETTE.muted, padding: "6px 0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Calculator size={16} color={PALETTE.gold} />
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Custos fixos do seu negócio</h3>
        </div>
        <p style={{ fontSize: 12, color: PALETTE.muted, marginTop: 0, marginBottom: 14 }}>
          Preencha uma vez — esses valores ficam salvos e são usados em todo cálculo de preço.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Preço do filamento (R$/kg)
            <input
              type="number"
              min="0"
              step="0.01"
              value={settingsDraft.filamentPricePerKg}
              onChange={(e) => updateSetting("filamentPricePerKg", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Energia (R$/kWh)
            <input
              type="number"
              min="0"
              step="0.01"
              value={settingsDraft.energyPricePerKwh}
              onChange={(e) => updateSetting("energyPricePerKwh", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Potência da impressora (W)
            <input
              type="number"
              min="0"
              value={settingsDraft.printerWattage}
              onChange={(e) => updateSetting("printerWattage", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Desgaste da impressora (R$/hora)
            <input
              type="number"
              min="0"
              step="0.01"
              value={settingsDraft.toolsCostPerHour}
              onChange={(e) => updateSetting("toolsCostPerHour", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Sua hora de trabalho (R$/h)
            <input
              type="number"
              min="0"
              step="0.01"
              value={settingsDraft.laborHourlyRate}
              onChange={(e) => updateSetting("laborHourlyRate", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Reserva para falhas (%)
            <input
              type="number"
              min="0"
              value={settingsDraft.failureRatePercent}
              onChange={(e) => updateSetting("failureRatePercent", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Margem de lucro padrão (%)
            <input
              type="number"
              min="0"
              value={settingsDraft.marginPercent}
              onChange={(e) => updateSetting("marginPercent", e.target.value)}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
        </div>
        <button
          onClick={saveSettings}
          style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <Check size={14} /> Salvar configurações
        </button>
      </div>

      <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 18 }}>
        <h3 style={{ margin: "0 0 14px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Dados desta peça</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Peso da peça (gramas)
            <input
              type="number"
              min="0"
              value={weight}
              onChange={(e) => setWeight(Math.max(0, Number(e.target.value) || 0))}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Tempo de impressão (horas)
            <input
              type="number"
              min="0"
              step="0.1"
              value={printHours}
              onChange={(e) => setPrintHours(Math.max(0, Number(e.target.value) || 0))}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Mão de obra (minutos)
            <input
              type="number"
              min="0"
              value={laborMinutes}
              onChange={(e) => setLaborMinutes(Math.max(0, Number(e.target.value) || 0))}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Utensílios usados na peça (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={extraMaterialsCost}
              onChange={(e) => setExtraMaterialsCost(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Chaveiro, parafuso, ímã..."
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Quantidade (lote)
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
          <label style={{ fontSize: 12, color: PALETTE.muted }}>
            Margem só para esta peça (%, opcional)
            <input
              type="number"
              min="0"
              placeholder={String(settingsDraft.marginPercent)}
              value={customMargin === null ? "" : customMargin}
              onChange={(e) => setCustomMargin(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
              style={{ width: "100%", marginTop: 4, background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" }}
            />
          </label>
        </div>
      </div>

      <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.gold, borderRadius: 12, padding: 18 }}>
        <h3 style={{ margin: "0 0 10px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Resultado</h3>
        <div style={{ borderBottom: "1px solid " + PALETTE.border, paddingBottom: 8, marginBottom: 8 }}>
          <div style={row}>
            <span>Filamento</span>
            <span>{formatBRL(filamentCost)}</span>
          </div>
          <div style={row}>
            <span>Energia</span>
            <span>{formatBRL(energyCost)}</span>
          </div>
          <div style={row}>
            <span>Desgaste da impressora</span>
            <span>{formatBRL(toolsCost)}</span>
          </div>
          <div style={row}>
            <span>Mão de obra</span>
            <span>{formatBRL(laborCost)}</span>
          </div>
          <div style={row}>
            <span>Utensílios usados na peça</span>
            <span>{formatBRL(extraCost)}</span>
          </div>
          <div style={row}>
            <span>Reserva para falhas ({settingsDraft.failureRatePercent}%)</span>
            <span>{formatBRL(failureReserve)}</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: PALETTE.text, marginBottom: 4 }}>
          <span>Custo total (1 peça)</span>
          <span style={{ fontWeight: 600 }}>{formatBRL(totalCost)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: PALETTE.text, marginBottom: 14 }}>
          <span>Margem aplicada</span>
          <span style={{ fontWeight: 600 }}>{margin}%</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            background: PALETTE.surface2,
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, color: PALETTE.muted }}>Preço de venda sugerido</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: PALETTE.goldBright }}>{formatBRL(salePrice)}</span>
        </div>
        <div style={row}>
          <span>Lucro por peça</span>
          <span style={{ color: PALETTE.gold, fontWeight: 600 }}>{formatBRL(profit)}</span>
        </div>
        {qty > 1 && (
          <>
            <div style={{ borderTop: "1px dashed " + PALETTE.border, marginTop: 10, paddingTop: 10 }}>
              <div style={row}>
                <span>Preço do lote ({qty} peças)</span>
                <span style={{ color: PALETTE.text, fontWeight: 600 }}>{formatBRL(salePrice * qty)}</span>
              </div>
              <div style={row}>
                <span>Lucro do lote</span>
                <span style={{ color: PALETTE.gold, fontWeight: 600 }}>{formatBRL(profit * qty)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {products.length > 0 && (
        <div style={{ background: PALETTE.surface, border: "1px solid " + PALETTE.border, borderRadius: 12, padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: PALETTE.text }}>Aplicar este preço a um produto</h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={applyProductId}
              onChange={(e) => setApplyProductId(e.target.value)}
              style={{ background: PALETTE.surface2, border: "1px solid " + PALETTE.border, borderRadius: 8, color: PALETTE.text, padding: "8px 10px", fontSize: 13, minWidth: 220 }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (atual: {formatBRL(p.price)})
                </option>
              ))}
            </select>
            <button
              onClick={applyToProduct}
              style={{ display: "flex", alignItems: "center", gap: 6, background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Check size={14} /> Usar {formatBRL(salePrice)} neste produto
            </button>
          </div>
          {applyMsg && <p style={{ fontSize: 12, color: PALETTE.gold, marginTop: 10 }}>{applyMsg}</p>}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, fontSize: 11, color: PALETTE.muted, background: "rgba(217,164,76,0.06)", border: "1px solid " + PALETTE.border, borderRadius: 10, padding: 14 }}>
        <Info size={26} color={PALETTE.gold} style={{ flexShrink: 0 }} />
        <span>
          Fórmula baseada nas práticas mais comuns entre makers e prestadores de impressão 3D no Brasil: material + energia + desgaste/utensílios + mão de obra + reserva para falhas, tudo multiplicado
          pela margem de lucro desejada. Ajuste os valores fixos conforme sua realidade — eles variam bastante por região e tipo de impressora.
        </span>
      </div>
    </div>
  );
}

function AdminPanel({
  products,
  setProducts,
  whatsapp,
  setWhatsapp,
  sales,
  setSales,
  banners,
  setBanners,
  benefits,
  setBenefits,
  categories,
  setCategories,
  heroContent,
  setHeroContent,
  pricingSettings,
  setPricingSettings,
  saveStatus,
  saveErrorDetail,
  onRetrySave,
  onExit,
}) {
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

  function autoFillShowcase() {
    const alreadyFeatured = products.filter((p) => p.featured).length;
    let toFeature = Math.max(0, 5 - alreadyFeatured);
    const missingRating = products.filter((p) => !p.rating || p.rating <= 0).length;
    const missingFeatured = products.filter((p) => !p.featured).length;
    if (missingRating === 0 && (toFeature === 0 || missingFeatured === 0)) {
      alert("Todos os produtos já têm avaliação e não há mais nada para preencher.");
      return;
    }
    if (!window.confirm("Isso vai preencher avaliação/nº de avaliações para produtos sem nota, e marcar até 5 produtos como destaque (sem mexer no que você já definiu). Continuar?")) return;
    setProducts((prev) =>
      prev.map((p) => {
        const next = { ...p };
        if (!next.rating || next.rating <= 0) {
          next.rating = Math.round((4.3 + Math.random() * 0.7) * 10) / 10;
          next.reviewCount = Math.floor(6 + Math.random() * 50);
        }
        if (!next.featured && toFeature > 0) {
          next.featured = true;
          toFeature--;
        }
        return next;
      })
    );
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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={autoFillShowcase}
            title="Preenche avaliação e destaque para produtos que ainda não têm"
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid " + PALETTE.gold, color: PALETTE.gold, borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Star size={14} /> Preencher exemplos
          </button>
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

      {saveStatus === "error" && (
        <div
          style={{
            background: "rgba(192,57,43,0.12)",
            border: "1px solid " + PALETTE.danger,
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, color: PALETTE.text, flex: 1, minWidth: 220 }}>⚠️ {saveErrorDetail}</span>
          <button
            onClick={onRetrySave}
            style={{ background: PALETTE.danger, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
          >
            Tentar salvar de novo
          </button>
        </div>
      )}
      {saveStatus === "saving" && (
        <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>Salvando alterações…</div>
      )}
      {saveStatus === "saved" && (
        <div style={{ fontSize: 12, color: PALETTE.muted, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Check size={13} color={PALETTE.gold} /> Tudo salvo
        </div>
      )}

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
          <Megaphone size={14} /> Vitrine
        </button>
        <button
          onClick={() => setTab("pricing")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            borderBottom: tab === "pricing" ? "2px solid " + PALETTE.gold : "2px solid transparent",
            color: tab === "pricing" ? PALETTE.text : PALETTE.muted,
            padding: "10px 6px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Calculator size={14} /> Precificação
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
                <AdminProductForm key={p.id} product={p} categories={categories} onSave={saveProduct} onCancel={() => setEditingId(null)} onDelete={deleteProduct} />
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
                    src={(p.media && p.media[0] && p.media[0].url) || LOGO_URI}
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
      ) : tab === "banners" ? (
        <>
          <AdminBanners banners={banners} setBanners={setBanners} />
          <AdminBenefits benefits={benefits} setBenefits={setBenefits} />
          <AdminCategories categories={categories} setCategories={setCategories} products={products} />
          <AdminHeroText heroContent={heroContent} setHeroContent={setHeroContent} />
        </>
      ) : (
        <AdminPricingCalculator products={products} setProducts={setProducts} pricingSettings={pricingSettings} setPricingSettings={setPricingSettings} />
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

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Erro inesperado no site:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: PALETTE.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <p style={{ color: PALETTE.text, fontSize: 15, marginBottom: 8 }}>Algo deu errado ao carregar essa página.</p>
            <p style={{ color: PALETTE.muted, fontSize: 13, marginBottom: 18 }}>
              Nada foi perdido — seus dados continuam salvos no banco. Recarregue a página para tentar de novo.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [whatsapp, setWhatsapp] = useState(DEFAULT_WHATSAPP);
  const [sales, setSales] = useState([]);
  const [banners, setBanners] = useState(INITIAL_BANNERS);
  const [benefits, setBenefits] = useState(INITIAL_BENEFITS);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [heroContent, setHeroContent] = useState(INITIAL_HERO_CONTENT);
  const [pricingSettings, setPricingSettings] = useState(INITIAL_PRICING_SETTINGS);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const lastKnownUpdatedAt = useRef(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveErrorDetail, setSaveErrorDetail] = useState("");
  const [view, setView] = useState("shop");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
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
    async function loadProfile(uid) {
      try {
        const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        setProfile(data || null);
      } catch (e) {
        setProfile(null);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session ? data.session.user : null;
      setUser(sessionUser);
      if (sessionUser) loadProfile(sessionUser.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session ? session.user : null;
      setUser(sessionUser);
      if (sessionUser) {
        loadProfile(sessionUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    if (view === "orders") setView("shop");
  }

  async function saveOrderRecord(cartItems, total, orderNote) {
    if (!user) return;
    try {
      const items = cartItems.map((item) => {
        const p = products.find((pr) => pr.id === item.productId);
        return { productId: item.productId, name: p ? p.name : "", colorName: item.colorName, sizeName: item.sizeName, qty: item.qty, unitPrice: p ? p.price : 0 };
      });
      await supabase.from("orders").insert({ user_id: user.id, items, total, note: orderNote || null });
    } catch (e) {
      console.error("Erro ao salvar histórico de pedido:", e);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("moldeq_catalog").select("data, updated_at").eq("id", STORAGE_KEY).maybeSingle();
        if (error) throw error;
        if (data && data.data) {
          let loadedProducts = data.data.products || INITIAL_PRODUCTS;
          let loadedBanners = data.data.banners || INITIAL_BANNERS;
          setWhatsapp(data.data.whatsapp || DEFAULT_WHATSAPP);
          setSales(data.data.sales || []);
          setBenefits(data.data.benefits || INITIAL_BENEFITS);
          setCategories(data.data.categories || INITIAL_CATEGORIES);
          setHeroContent({ ...INITIAL_HERO_CONTENT, ...(data.data.heroContent || {}) });
          setPricingSettings({ ...INITIAL_PRICING_SETTINGS, ...(data.data.pricingSettings || {}) });
          lastKnownUpdatedAt.current = data.updated_at || null;

          if (hasLegacyBase64Images(loadedProducts, loadedBanners)) {
            setMigrating(true);
            try {
              const migrated = await migrateBase64ToStorage(loadedProducts, loadedBanners);
              loadedProducts = migrated.products;
              loadedBanners = migrated.banners;
            } catch (migErr) {
              console.error("Erro ao migrar fotos para o Storage:", migErr);
            }
            setMigrating(false);
          }

          setProducts(loadedProducts);
          setBanners(loadedBanners);
        } else {
          const nowIso = new Date().toISOString();
          await supabase.from("moldeq_catalog").upsert({
            id: STORAGE_KEY,
            updated_at: nowIso,
            data: {
              products: INITIAL_PRODUCTS,
              whatsapp: DEFAULT_WHATSAPP,
              sales: [],
              banners: INITIAL_BANNERS,
              benefits: INITIAL_BENEFITS,
              categories: INITIAL_CATEGORIES,
              heroContent: INITIAL_HERO_CONTENT,
              pricingSettings: INITIAL_PRICING_SETTINGS,
            },
          });
          lastKnownUpdatedAt.current = nowIso;
        }
      } catch (e) {
        console.error("Erro ao carregar catálogo do Supabase:", e);
        setLoadError(true);
        setLoading(false);
        return;
      }
      setLoading(false);
    })();
  }, []);

  const latestPayloadRef = useRef(null);
  latestPayloadRef.current = { products, whatsapp, sales, banners, benefits, categories, heroContent, pricingSettings };

  async function persistCatalog() {
    if (loadError) return;
    // Safety check: if the catalog was updated elsewhere (another tab/device) since we
    // loaded it, refuse to blindly overwrite — that is exactly how real data gets lost.
    try {
      const { data: current } = await supabase.from("moldeq_catalog").select("updated_at").eq("id", STORAGE_KEY).maybeSingle();
      if (current && current.updated_at && lastKnownUpdatedAt.current && current.updated_at !== lastKnownUpdatedAt.current) {
        setSaveStatus("error");
        setSaveErrorDetail("O catálogo foi alterado em outra aba ou aparelho enquanto você editava aqui. Para não perder nada, recarregue a página antes de continuar editando.");
        return;
      }
    } catch (e) {
      // if this safety check itself fails, fall through and still attempt to save normally
    }
    // Always read the ref here (not the closed-over products/whatsapp/... variables) —
    // this call may be running from an older render's closure (e.g. a queued retry that
    // fires after newer edits already happened), and the ref always holds the latest
    // state regardless of which render's closure triggered this save.
    const payload = latestPayloadRef.current;
    const json = JSON.stringify(payload);
    if (json.length > 4_500_000) {
      const sizeMB = (json.length / (1024 * 1024)).toFixed(1);
      setSaveStatus("error");
      setSaveErrorDetail(
        "O catálogo ficou muito grande (" + sizeMB + "MB) para salvar de uma vez. Alguma foto ou vídeo enviado recentemente pode estar sem compressão — troque por uma imagem menor ou remova o vídeo mais pesado."
      );
      return;
    }
    setSaveStatus("saving");
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("moldeq_catalog").upsert({ id: STORAGE_KEY, data: payload, updated_at: nowIso });
      if (error) throw error;
      lastKnownUpdatedAt.current = nowIso;
      setSaveStatus("saved");
      setSaveErrorDetail("");
    } catch (e) {
      console.error("Erro ao salvar catálogo no Supabase:", e);
      setSaveStatus("error");
      setSaveErrorDetail("Não consegui salvar as últimas alterações (falha de conexão com o banco de dados). Elas ainda não estão seguras — tente novamente antes de sair da página.");
    }
  }

  // Debounce + serialize saves: rapid edits are batched into one save after a short
  // quiet period, and if a save is still in flight when another is due, it queues
  // instead of firing in parallel — two overlapping writes racing is exactly how an
  // earlier edit could silently overwrite a later one.
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const saveTimerRef = useRef(null);

  async function runQueuedSave() {
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    pendingSaveRef.current = false;
    await persistCatalog();
    savingRef.current = false;
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      runQueuedSave();
    }
  }

  useEffect(() => {
    if (loading || migrating || loadError) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      runQueuedSave();
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [products, whatsapp, sales, banners, benefits, categories, heroContent, pricingSettings, loading, migrating, loadError]);

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
    return products.filter(
      (p) => p.active && p.name.toLowerCase().includes(search.toLowerCase()) && (!categoryFilter || p.category === categoryFilter)
    );
  }, [products, search, categoryFilter]);

  const featuredProducts = useMemo(() => {
    return products.filter((p) => p.active && p.featured);
  }, [products]);

  const selectedProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) : null;

  function openProduct(id) {
    setSelectedProductId(id);
    setView("product");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function closeProduct() {
    setView("shop");
    setSelectedProductId(null);
  }

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

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", ...pageBackground, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        {fontImport}
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <p style={{ color: PALETTE.text, fontSize: 15, marginBottom: 8 }}>Não consegui carregar o catálogo agora.</p>
          <p style={{ color: PALETTE.muted, fontSize: 13, marginBottom: 18 }}>
            Isso costuma ser uma instabilidade de conexão passageira. Por segurança, o site não mostra nem salva nada até conseguir carregar seus dados de verdade.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: PALETTE.gold, color: "#1A1204", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (loading || migrating) {
    return (
      <div style={{ minHeight: "100vh", ...pageBackground, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        {fontImport}
        <span style={{ color: PALETTE.muted, fontFamily: "Inter, sans-serif", textAlign: "center", maxWidth: 320, fontSize: 14 }}>
          {migrating ? "Otimizando fotos existentes para carregar mais rápido — isso acontece só uma vez, pode levar um instante…" : "Carregando catálogo…"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", ...pageBackground, fontFamily: "'Inter', sans-serif", color: PALETTE.text }}>
      {fontImport}

      <header style={{ borderBottom: "1px solid " + PALETTE.border, position: "sticky", top: 0, background: "rgba(20,22,28,0.92)", backdropFilter: "blur(6px)", zIndex: 30 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={closeProduct}>
            <img src={LOGO_URI} alt="Moldeq" style={{ height: 34 }} />
          </div>
          {view === "shop" && (
            <CategoryFilter categories={categories} selected={categoryFilter} onSelect={setCategoryFilter} />
          )}
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
            {(view === "shop" || view === "product" || view === "orders") && (
              <AccountMenu
                user={user}
                profile={profile}
                onOpenAuth={() => setAuthModalOpen(true)}
                onLogout={handleLogout}
                onOpenOrders={() => setView("orders")}
              />
            )}
            {(view === "shop" || view === "product" || view === "orders") && (
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

      {view === "admin" ? (
        <AdminPanel
          products={products}
          setProducts={setProducts}
          whatsapp={whatsapp}
          setWhatsapp={setWhatsapp}
          sales={sales}
          setSales={setSales}
          banners={banners}
          setBanners={setBanners}
          benefits={benefits}
          setBenefits={setBenefits}
          categories={categories}
          setCategories={setCategories}
          heroContent={heroContent}
          setHeroContent={setHeroContent}
          pricingSettings={pricingSettings}
          setPricingSettings={setPricingSettings}
          saveStatus={saveStatus}
          saveErrorDetail={saveErrorDetail}
          onRetrySave={runQueuedSave}
          onExit={() => setView("shop")}
        />
      ) : (
        <>
          {view === "shop" ? (
            <>
              <BannerCarousel banners={banners} />
              <BenefitsStrip benefits={benefits} />
              <ProductRail title="Mais vendidos" products={featuredProducts} onOpenProduct={openProduct} />
              <section style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 20px 30px", textAlign: "center" }}>
                <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: PALETTE.gold, marginBottom: 14 }}>
                  {heroContent.eyebrow}
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 5vw, 46px)", margin: "0 0 14px", lineHeight: 1.15 }}>
                  {heroContent.title.split("\n").map((line, i, arr) => (
                    <span key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
                </h1>
                <p style={{ color: PALETTE.muted, maxWidth: 520, margin: "0 auto", fontSize: 15, lineHeight: 1.6 }}>{heroContent.subtitle}</p>
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
                      <ProductCard key={p.id} product={p} onAddToCart={addToCart} onOpenProduct={openProduct} toast={showToast} />
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
            </>
          ) : view === "product" ? (
            selectedProduct ? (
              <ProductDetailPage product={selectedProduct} allProducts={products} onAddToCart={addToCart} onBack={closeProduct} onOpenProduct={openProduct} toast={showToast} />
            ) : (
              <div style={{ padding: "80px 20px", textAlign: "center", color: PALETTE.muted }}>
                Produto não encontrado.{" "}
                <span onClick={closeProduct} style={{ color: PALETTE.gold, cursor: "pointer" }}>
                  Voltar ao catálogo
                </span>
              </div>
            )
          ) : view === "orders" && user ? (
            <OrdersPage user={user} onBack={() => setView("shop")} />
          ) : null}

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
            customerName={profile && profile.name ? profile.name : ""}
            onSent={() => {
              showToast("Pedido aberto no WhatsApp!");
              const total = cart.reduce((sum, item) => {
                const p = products.find((pr) => pr.id === item.productId);
                return sum + (p ? p.price * item.qty : 0);
              }, 0);
              saveOrderRecord(cart, total, note);
            }}
          />

          {!cartOpen && <CustomOrderButton whatsapp={whatsapp} />}

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
      )}

      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onAuthenticated={() => {
            setAuthModalOpen(false);
            showToast("Login feito com sucesso!");
          }}
        />
      )}

      <Toast message={toastMsg} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
