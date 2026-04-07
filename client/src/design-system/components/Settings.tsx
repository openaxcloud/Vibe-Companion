/**
 * Settings Panel
 * Beautiful settings interface with theme customization
 */

import React, { useState, useCallback } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export interface SettingsSection {
  id: string;
  title: string;
  icon?: string;
  items: SettingsItem[];
}

export type SettingsItem =
  | ToggleItem
  | SelectItem
  | SliderItem
  | ActionItem
  | InfoItem;

export interface BaseItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface ToggleItem extends BaseItem {
  type: 'toggle';
  value: boolean;
  onChange: (value: boolean) => void;
}

export interface SelectItem extends BaseItem {
  type: 'select';
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}

export interface SliderItem extends BaseItem {
  type: 'slider';
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export interface ActionItem extends BaseItem {
  type: 'action';
  buttonLabel: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface InfoItem extends BaseItem {
  type: 'info';
  value: string;
}

export interface SettingsProps {
  sections: SettingsSection[];
  onClose?: () => void;
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

export const Settings: React.FC<SettingsProps> = ({ sections, onClose }) => {
  const ds = useDesignSystem();
  const [activeSection, setActiveSection] = useState(sections[0]?.id);

  const handleClose = useCallback(() => {
    triggerHaptic('selection');
    onClose?.();
  }, [onClose]);

  const activeSectionData = sections.find((s) => s.id === activeSection);

  return (
    <LazyMotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: ds.zIndex.modal,
        backgroundColor: ds.colors.background.primary,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: ds.spacing[5],
          paddingTop: `calc(${ds.spacing[5]} + env(safe-area-inset-top, 0px))`,
          borderBottom: `1px solid ${ds.colors.separator.nonOpaque}`,
        }}
      >
        <h1
          style={{
            ...ds.typography.textStyles.largeTitle,
            color: ds.colors.text.primary,
            margin: 0,
          }}
        >
          Settings
        </h1>
        {onClose && (
          <LazyMotionButton
            onClick={handleClose}
            whileTap={{ scale: 0.95 }}
            style={{
              ...ds.typography.textStyles.body,
              fontWeight: 600,
              padding: `${ds.spacing[3]} ${ds.spacing[4]}`,
              backgroundColor: ds.colors.fill.secondary,
              color: ds.colors.text.primary,
              border: 'none',
              borderRadius: ds.borderRadius.lg,
              cursor: 'pointer',
              minHeight: ds.touchTargets.min,
            }}
          >
            Done
          </LazyMotionButton>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: ds.device.isMobile ? 'flex' : 'grid',
          gridTemplateColumns: ds.device.isMobile ? '1fr' : '250px 1fr',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar (Desktop) or Full Page List (Mobile) */}
        {!ds.device.isMobile && (
          <div
            style={{
              borderRight: `1px solid ${ds.colors.separator.nonOpaque}`,
              overflowY: 'auto',
              padding: ds.spacing[4],
            }}
          >
            {sections.map((section) => (
              <LazyMotionButton
                key={section.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveSection(section.id);
                }}
                whileTap={{ scale: 0.98 }}
                style={{
                  ...ds.typography.textStyles.callout,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: ds.spacing[3],
                  padding: `${ds.spacing[4]} ${ds.spacing[4]}`,
                  backgroundColor:
                    activeSection === section.id
                      ? ds.colors.fill.secondary
                      : 'transparent',
                  color: ds.colors.text.primary,
                  border: 'none',
                  borderRadius: ds.borderRadius.md,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                  marginBottom: ds.spacing[2],
                }}
              >
                {section.icon && <span style={{ fontSize: '20px' }}>{section.icon}</span>}
                {section.title}
              </LazyMotionButton>
            ))}
          </div>
        )}

        {/* Settings Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: ds.spacing[5],
            paddingBottom: `calc(${ds.spacing[10]} + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <LazyAnimatePresence mode="wait">
            {activeSectionData && (
              <LazyMotionDiv
                key={activeSectionData.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2
                  style={{
                    ...ds.typography.textStyles.title2,
                    color: ds.colors.text.primary,
                    marginBottom: ds.spacing[6],
                    margin: `0 0 ${ds.spacing[6]} 0`,
                  }}
                >
                  {activeSectionData.title}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: ds.spacing[5] }}>
                  {activeSectionData.items.map((item) => (
                    <SettingItemRenderer key={item.id} item={item} />
                  ))}
                </div>
              </LazyMotionDiv>
            )}
          </LazyAnimatePresence>
        </div>
      </div>
    </LazyMotionDiv>
  );
};

// ============================================================================
// SETTINGS ITEM RENDERER
// ============================================================================

const SettingItemRenderer: React.FC<{ item: SettingsItem }> = ({ item }) => {
  switch (item.type) {
    case 'toggle':
      return <ToggleSettingItem item={item} />;
    case 'select':
      return <SelectSettingItem item={item} />;
    case 'slider':
      return <SliderSettingItem item={item} />;
    case 'action':
      return <ActionSettingItem item={item} />;
    case 'info':
      return <InfoSettingItem item={item} />;
    default:
      return null;
  }
};

// ============================================================================
// TOGGLE SETTING ITEM
// ============================================================================

const ToggleSettingItem: React.FC<{ item: ToggleItem }> = ({ item }) => {
  const ds = useDesignSystem();

  const handleToggle = () => {
    triggerHaptic('light');
    item.onChange(!item.value);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ds.spacing[4],
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...ds.typography.textStyles.callout,
            color: ds.colors.text.primary,
            marginBottom: item.description ? ds.spacing[1] : 0,
          }}
        >
          {item.icon && <span style={{ marginRight: ds.spacing[2] }}>{item.icon}</span>}
          {item.label}
        </div>
        {item.description && (
          <div
            style={{
              ...ds.typography.textStyles.footnote,
              color: ds.colors.text.secondary,
            }}
          >
            {item.description}
          </div>
        )}
      </div>

      {/* Toggle Switch */}
      <LazyMotionButton
        onClick={handleToggle}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'relative',
          width: '51px',
          height: '31px',
          borderRadius: '15.5px',
          backgroundColor: item.value
            ? ds.colors.feedback.success
            : ds.colors.fill.tertiary,
          border: 'none',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease',
          flexShrink: 0,
        }}
      >
        <LazyMotionDiv
          animate={{
            x: item.value ? 20 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '27px',
            height: '27px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        />
      </LazyMotionButton>
    </div>
  );
};

// ============================================================================
// SELECT SETTING ITEM
// ============================================================================

const SelectSettingItem: React.FC<{ item: SelectItem }> = ({ item }) => {
  const ds = useDesignSystem();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <div
        style={{
          ...ds.typography.textStyles.callout,
          color: ds.colors.text.primary,
          marginBottom: ds.spacing[3],
        }}
      >
        {item.icon && <span style={{ marginRight: ds.spacing[2] }}>{item.icon}</span>}
        {item.label}
      </div>
      {item.description && (
        <div
          style={{
            ...ds.typography.textStyles.footnote,
            color: ds.colors.text.secondary,
            marginBottom: ds.spacing[3],
          }}
        >
          {item.description}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: ds.spacing[3] }}>
        {item.options.map((option) => {
          const isSelected = option.value === item.value;
          return (
            <LazyMotionButton
              key={option.value}
              onClick={() => {
                triggerHaptic('selection');
                item.onChange(option.value);
              }}
              whileTap={{ scale: 0.95 }}
              style={{
                ...ds.typography.textStyles.callout,
                padding: `${ds.spacing[3]} ${ds.spacing[5]}`,
                backgroundColor: isSelected
                  ? ds.colors.interactive.primary
                  : ds.colors.fill.secondary,
                color: isSelected ? '#FFFFFF' : ds.colors.text.primary,
                border: 'none',
                borderRadius: ds.borderRadius.lg,
                cursor: 'pointer',
                fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              {option.label}
            </LazyMotionButton>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// SLIDER SETTING ITEM
// ============================================================================

const SliderSettingItem: React.FC<{ item: SliderItem }> = ({ item }) => {
  const ds = useDesignSystem();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: ds.spacing[3],
        }}
      >
        <div
          style={{
            ...ds.typography.textStyles.callout,
            color: ds.colors.text.primary,
          }}
        >
          {item.icon && <span style={{ marginRight: ds.spacing[2] }}>{item.icon}</span>}
          {item.label}
        </div>
        <div
          style={{
            ...ds.typography.textStyles.callout,
            fontWeight: 600,
            color: ds.colors.interactive.primary,
          }}
        >
          {item.value}
          {item.unit}
        </div>
      </div>

      {item.description && (
        <div
          style={{
            ...ds.typography.textStyles.footnote,
            color: ds.colors.text.secondary,
            marginBottom: ds.spacing[3],
          }}
        >
          {item.description}
        </div>
      )}

      <input
        type="range"
        min={item.min}
        max={item.max}
        step={item.step || 1}
        value={item.value}
        onChange={(e) => {
          triggerHaptic('selection');
          item.onChange(Number(e.target.value));
        }}
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '3px',
          outline: 'none',
          background: `linear-gradient(to right, ${ds.colors.interactive.primary} 0%, ${ds.colors.interactive.primary} ${
            ((item.value - item.min) / (item.max - item.min)) * 100
          }%, ${ds.colors.fill.tertiary} ${
            ((item.value - item.min) / (item.max - item.min)) * 100
          }%, ${ds.colors.fill.tertiary} 100%)`,
          WebkitAppearance: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  );
};

// ============================================================================
// ACTION SETTING ITEM
// ============================================================================

const ActionSettingItem: React.FC<{ item: ActionItem }> = ({ item }) => {
  const ds = useDesignSystem();

  return (
    <div>
      {item.label && (
        <>
          <div
            style={{
              ...ds.typography.textStyles.callout,
              color: ds.colors.text.primary,
              marginBottom: ds.spacing[3],
            }}
          >
            {item.icon && <span style={{ marginRight: ds.spacing[2] }}>{item.icon}</span>}
            {item.label}
          </div>
          {item.description && (
            <div
              style={{
                ...ds.typography.textStyles.footnote,
                color: ds.colors.text.secondary,
                marginBottom: ds.spacing[3],
              }}
            >
              {item.description}
            </div>
          )}
        </>
      )}

      <LazyMotionButton
        onClick={() => {
          triggerHaptic(item.destructive ? 'warning' : 'medium');
          item.onPress();
        }}
        whileTap={{ scale: 0.95 }}
        style={{
          ...ds.typography.textStyles.callout,
          fontWeight: 600,
          width: '100%',
          padding: `${ds.spacing[4]} ${ds.spacing[5]}`,
          backgroundColor: item.destructive
            ? ds.colors.feedback.error
            : ds.colors.interactive.primary,
          color: '#FFFFFF',
          border: 'none',
          borderRadius: ds.borderRadius.lg,
          cursor: 'pointer',
          minHeight: ds.touchTargets.min,
        }}
      >
        {item.buttonLabel}
      </LazyMotionButton>
    </div>
  );
};

// ============================================================================
// INFO SETTING ITEM
// ============================================================================

const InfoSettingItem: React.FC<{ item: InfoItem }> = ({ item }) => {
  const ds = useDesignSystem();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: ds.spacing[4],
      }}
    >
      <div
        style={{
          ...ds.typography.textStyles.callout,
          color: ds.colors.text.primary,
        }}
      >
        {item.icon && <span style={{ marginRight: ds.spacing[2] }}>{item.icon}</span>}
        {item.label}
      </div>
      <div
        style={{
          ...ds.typography.textStyles.callout,
          color: ds.colors.text.secondary,
          fontFamily: ds.typography.fontFamily.mono,
        }}
      >
        {item.value}
      </div>
    </div>
  );
};

export default Settings;
