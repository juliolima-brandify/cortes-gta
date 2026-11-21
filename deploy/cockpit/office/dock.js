/*!
 * Lucide icons — ISC License
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ArrowLeft and X are derived from Feather — MIT License
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  ListFilter,
  ListVideo,
  Maximize2,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Scissors,
  X,
  createElement,
} from "lucide";

const glyphs = new Map([
  ["arrow-left", ArrowLeft],
  ["bell", Bell],
  ["building-2", Building2],
  ["calendar-days", CalendarDays],
  ["list-filter", ListFilter],
  ["list-video", ListVideo],
  ["maximize-2", Maximize2],
  ["radio-tower", RadioTower],
  ["refresh-cw", RefreshCw],
  ["rotate-ccw", RotateCcw],
  ["scissors", Scissors],
  ["x", X],
]);

export function startDock(office = document.getElementById("escritorio")) {
  for (const marker of document.querySelectorAll("[data-cockpit-icon]")) {
    const name = marker.dataset.cockpitIcon;
    const glyph = glyphs.get(name);
    if (!glyph || marker.firstElementChild?.getAttribute("data-cockpit-glyph") === name) continue;
    marker.replaceChildren(createElement(glyph, {
      "aria-hidden": "true",
      "data-cockpit-glyph": name,
      focusable: "false",
    }));
  }
  const stations = {torre: "captura", cortes: "garimpo", edicao: "edicao", agenda: "agenda"};
  for (const link of document.querySelectorAll(".menu .dock-item")) {
    const label = link.querySelector(".dock-rotulo");
    if (label) {
      label.id = `dock-tip-${link.dataset.view}`;
      label.setAttribute("role", "tooltip");
      link.setAttribute("aria-describedby", label.id);
      if (!link.hasAttribute("aria-label")) link.setAttribute("aria-label", label.textContent);
    }
    const highlight = active => office?.dispatchEvent(new CustomEvent("cockpit:destaque", {
      detail: {station: active ? stations[link.dataset.view] || null : null},
    }));
    link.addEventListener("pointerenter", () => highlight(true));
    link.addEventListener("pointerleave", () => highlight(link.matches(":focus-visible")));
    link.addEventListener("focus", () => highlight(true));
    link.addEventListener("blur", () => highlight(false));
    link.addEventListener("click", () => highlight(false));
  }
}
