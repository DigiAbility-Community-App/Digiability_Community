"use client";

import { useState } from "react";

import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  Database,
} from "lucide-react";

// ----------------------
// DATA
// ----------------------

const settingsMenu = [
  "General",
  "User Roles",
  "Master Data",
  "Notifications",
  "Security",
  "Integrations",
  "Accessibility",
];

const disabilityTypes = [
  {
    id: "DT-01",
    name: "Visual Impairment",
    status: "Active",
  },

  {
    id: "DT-02",
    name: "Hearing Disability",
    status: "Active",
  },
];

const schemes = [
  {
    title: "Accessible India",
    subtitle: "Government Scheme",
  },

  {
    title: "UDID Support",
    subtitle: "Disability Card",
  },

  {
    title: "Scholarship Aid",
    subtitle: "Education Support",
  },
];

const resources = [
  {
    title: "Job Assistance",
    subtitle: "Employment",
  },

  {
    title: "Mental Wellness",
    subtitle: "Healthcare",
  },

  {
    title: "Accessibility Tools",
    subtitle: "Technology",
  },
];

// ----------------------
// COMPONENT
// ----------------------

export default function AdminSettingsPage() {
  const [platformEnabled, setPlatformEnabled] =
    useState(true);

  const [languages, setLanguages] =
    useState([
      "English",
      "Hindi",
      "Marathi",
    ]);

  return (
    <div className="min-h-screen bg-[#F4F1F8]">

      {/* PAGE */}
      <div className="px-10 py-8 max-w-[1450px] mx-auto">

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">

          {/* ===================== */}
          {/* LEFT SETTINGS PANEL */}
          {/* ===================== */}

          <div className="space-y-6">

            {/* MENU CARD */}
            <div className="bg-white rounded-[28px] border border-[#ECE7F2] shadow-[0px_4px_20px_rgba(0,0,0,0.03)] p-7">

              <h3 className="text-xs font-extrabold tracking-[0.2em] uppercase text-slate-400 mb-6">
                Settings Menu
              </h3>

              <div className="space-y-2">

                {settingsMenu.map(
                  (item, index) => (
                    <button
                      key={index}
                      className={`w-full h-12 rounded-xl px-4 flex items-center justify-between transition ${item === "Master Data"
                        ? "bg-[#D6BAFF] text-[#7004DC] font-bold shadow-sm"
                        : "hover:bg-[#F3F3F3] text-[#4B4355]"
                        }`}
                    >
                      <span className="text-sm">
                        {item}
                      </span>

                      <ChevronRight
                        className={`w-4 h-4 ${item === "Master Data"
                          ? "text-[#7004DC]"
                          : "text-slate-400"
                          }`}
                      />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* QUICK SYNC CARD */}
            <div className="relative overflow-hidden bg-[#8A38F5] rounded-2xl p-6 text-white">

              <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10" />

              <div className="relative z-10">

                <p className="text-sm text-white/70">
                  Last Synchronized
                </p>

                <h2 className="text-2xl font-extrabold mt-2">
                  2 minutes ago
                </h2>

                <div className="mt-5 inline-flex items-center gap-2 bg-white/20 rounded-md px-3 py-1 text-xs">

                  <div className="w-2 h-2 rounded-full bg-white" />

                  All systems operational
                </div>
              </div>
            </div>
          </div>

          {/* ===================== */}
          {/* RIGHT CONTENT */}
          {/* ===================== */}

          <div className="space-y-8">

            {/* GENERAL SETTINGS */}
            <div className="bg-white rounded-[30px] border border-[#ECE7F2] shadow-[0px_4px_20px_rgba(0,0,0,0.03)] p-10">

              {/* HEADER */}
              <div>
                <h2 className="text-2xl font-extrabold text-[#1A1C1C]">
                  General Settings
                </h2>

                <p className="text-sm text-[#4B4355]/70 mt-2">
                  Manage core platform information and configurations
                </p>
              </div>

              {/* FORM GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">

                {/* LEFT */}
                <div className="space-y-6">

                  <InputField
                    label="Platform Name"
                    value="DigiAbility Admin Portal"
                  />

                  <InputField
                    label="Email Configuration"
                    value="admin@digiability.org"
                  />
                </div>

                {/* RIGHT */}
                <div className="space-y-6">

                  <InputField
                    label="Support Phone"
                    value="+91 88000 12345"
                  />

                  {/* TOGGLE */}
                  <div>

                    <label className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">
                      Platform Status
                    </label>

                    <div className="mt-2 h-14 bg-[#F3F3F3] rounded-xl px-4 flex items-center gap-4">

                      <button
                        onClick={() =>
                          setPlatformEnabled(
                            !platformEnabled
                          )
                        }
                        className={`w-11 h-6 rounded-full relative transition ${platformEnabled
                          ? "bg-[#8A38F5]"
                          : "bg-slate-300"
                          }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${platformEnabled
                            ? "left-6"
                            : "left-1"
                            }`}
                        />
                      </button>

                      <span className="text-sm font-semibold text-[#4B4355]">
                        {platformEnabled
                          ? "Platform Active"
                          : "Platform Disabled"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LANGUAGES */}
              <div className="border-t border-[#E8E8E8] mt-10 pt-8">

                <h4 className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">
                  Supported Languages
                </h4>

                <div className="flex flex-wrap gap-4 mt-5">

                  {languages.map(
                    (language, index) => (
                      <div
                        key={index}
                        className="h-12 px-5 rounded-xl bg-[#EEDBFF] border border-[#8A38F5]/20 flex items-center gap-3"
                      >
                        <div className="w-4 h-4 rounded-sm bg-[#8A38F5] flex items-center justify-center">

                          <Check className="w-3 h-3 text-white" />
                        </div>

                        <span className="font-semibold text-[#1A1C1C]">
                          {language}
                        </span>
                      </div>
                    )
                  )}

                  <div className="h-12 px-5 rounded-xl bg-[#F3F3F3] opacity-60 flex items-center gap-3">

                    <div className="w-4 h-4 rounded-sm border border-slate-400" />

                    <span className="font-semibold text-[#1A1C1C]">
                      Tamil
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* DISABILITY TYPES */}
            <div className="bg-white rounded-2xl border border-[#CEC2D8]/20 shadow-sm overflow-hidden">

              {/* HEADER */}
              <div className="flex items-center justify-between p-8 border-b border-[#E8E8E8]">

                <div>
                  <h3 className="text-2xl font-extrabold text-[#1A1C1C]">
                    Disability Types
                  </h3>

                  <p className="text-sm text-[#4B4355]/70 mt-2">
                    Manage supported disability categories
                  </p>
                </div>

                <button className="h-11 px-5 rounded-xl bg-[#D2A500] hover:bg-[#b89300] transition flex items-center gap-2 font-bold text-[#4F3D00]">

                  <Plus className="w-4 h-4" />

                  Add New
                </button>
              </div>

              {/* TABLE */}
              <div>

                {/* HEADER */}
                <div className="grid grid-cols-[140px_1fr_180px_180px] bg-[#F3F3F3]">

                  <TableHeading label="ID" />

                  <TableHeading label="Disability Type" />

                  <TableHeading label="Status" />

                  <TableHeading label="Actions" />
                </div>

                {/* ROWS */}
                {disabilityTypes.map(
                  (item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[140px_1fr_180px_180px] items-center border-t border-[#EEEEEE]"
                    >

                      <TableCell mono>
                        {item.id}
                      </TableCell>

                      <TableCell>
                        {item.name}
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          Active
                        </span>
                      </TableCell>

                      <div className="px-8 flex items-center gap-3">

                        <button className="w-9 h-9 rounded-lg hover:bg-violet-50 flex items-center justify-center text-[#7004DC] transition">

                          <Pencil className="w-4 h-4" />
                        </button>

                        <button className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-700 transition">

                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* BOTTOM GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* GOVERNMENT SCHEMES */}
              <SmallSection
                title="Government Schemes"
                items={schemes}
              />

              {/* RESOURCES */}
              <SmallSection
                title="Resource Categories"
                items={resources}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------
// INPUT FIELD
// ----------------------

type InputFieldProps = {
  label: string;
  value: string;
};

const InputField = ({
  label,
  value,
}: InputFieldProps) => {
  return (
    <div>

      <label className="text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </label>

      <input
        defaultValue={value}
        className="mt-3 w-full h-14 bg-[#F7F5FA] rounded-2xl px-5 text-[#1A1C1C] outline-none border border-transparent focus:border-[#8A38F5]/20 focus:ring-4 focus:ring-[#8A38F5]/10 transition-all"
      />
    </div>
  );
};

// ----------------------
// TABLE HEADING
// ----------------------

type TableHeadingProps = {
  label: string;
};

const TableHeading = ({
  label,
}: TableHeadingProps) => {
  return (
    <div className="px-8 py-4 text-xs font-extrabold uppercase tracking-[0.15em] text-slate-500">
      {label}
    </div>
  );
};

// ----------------------
// TABLE CELL
// ----------------------

type TableCellProps = {
  children: React.ReactNode;
  mono?: boolean;
};

const TableCell = ({
  children,
  mono,
}: TableCellProps) => {
  return (
    <div
      className={`px-8 py-6 text-sm ${mono
        ? "font-mono text-[#1A1C1C]"
        : "font-semibold text-[#1A1C1C]"
        }`}
    >
      {children}
    </div>
  );
};

// ----------------------
// SMALL SECTION
// ----------------------

type SmallSectionProps = {
  title: string;
  items: {
    title: string;
    subtitle: string;
  }[];
};

const SmallSection = ({
  title,
  items,
}: SmallSectionProps) => {
  return (
    <div className="bg-white rounded-2xl border border-[#CEC2D8]/20 shadow-sm overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8E8E8]">

        <h3 className="text-lg font-extrabold text-[#1A1C1C]">
          {title}
        </h3>

        <button className="flex items-center gap-1 text-[#D2A500] font-bold text-sm">

          <Plus className="w-4 h-4" />

          Add
        </button>
      </div>

      {/* ITEMS */}
      <div className="p-6 space-y-4">

        {items.map((item, index) => (
          <div
            key={index}
            className="bg-[#F3F3F3] rounded-xl px-5 py-4 flex items-center justify-between"
          >

            <div>

              <h4 className="font-bold text-[#1A1C1C]">
                {item.title}
              </h4>

              <p className="text-xs text-[#4B4355] mt-1">
                {item.subtitle}
              </p>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        ))}
      </div>
    </div>
  );
};