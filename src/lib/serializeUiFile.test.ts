import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { resolveLabelAlignment, resolveLabelRendering } from './labelRendering.ts';
import {
  applyAnchor,
  parsedControlsToElements,
  resolveOffsetFromPosition,
  useStore,
} from '../store/useStore.ts';
import type { UIElement } from '../store/useStore.ts';
import { parseUiJson } from './parseUiJson.ts';
import { serializeUiFile } from './serializeUiFile.ts';

function buildParsedFile(rawJson: Record<string, unknown>) {
  return parseUiJson(rawJson, 'sample.json');
}

function buildElements(rawJson: Record<string, unknown>): {
  parsed: ReturnType<typeof buildParsedFile>;
  elements: UIElement[];
} {
  const parsed = buildParsedFile(rawJson);
  const root = parsed.rootControls[0];
  const elements = parsedControlsToElements(root?.controls || [], [320, 240]);
  return { parsed, elements };
}

function getFirstControl(
  serializedJson: Record<string, unknown>,
  rootKey: string,
): Record<string, unknown> {
  const root = serializedJson[rootKey] as Record<string, unknown>;
  const controls = root.controls as Array<Record<string, unknown>>;
  return controls[0];
}

function createTestElement(overrides: Partial<UIElement> = {}): UIElement {
  return {
    id: 'el_test',
    type: 'panel',
    sourceType: 'panel',
    name: 'panel_1',
    rawProps: {},
    size: [100, 100],
    offset: [0, 0],
    anchor_from: 'top_left',
    anchor_to: 'top_left',
    layer: 1,
    children: [],
    ...overrides,
  };
}

function resetEditorStore() {
  useStore.setState({
    project: null,
    activeFile: 'test.json',
    canvasSize: [320, 240],
    elements: [],
    drafts: { 'test.json': [] },
    selectedId: null,
    textureMap: {},
    history: {},
    canUndo: false,
    canRedo: false,
  } as Partial<ReturnType<typeof useStore.getState>>);
}

beforeEach(() => {
  resetEditorStore();
});

test('未编辑时保留根节点和子节点的布局表达式', () => {
  const rawJson = {
    namespace: 'test',
    sample_menu_root: {
      size: ['100%', '100%'],
      controls: [
        {
          'title@common.label': {
            size: ['50% + 10px', 'default'],
            offset: ['50%', '100%'],
            text: 'Hello',
          },
        },
      ],
    },
  };

  const { parsed, elements } = buildElements(rawJson);
  const serializedJson = JSON.parse(serializeUiFile(parsed, elements)) as Record<string, unknown>;
  const root = serializedJson.sample_menu_root as Record<string, unknown>;
  const control = getFirstControl(serializedJson, 'sample_menu_root');
  const label = control['title@common.label'] as Record<string, unknown>;

  assert.deepEqual(root.size, ['100%', '100%']);
  assert.deepEqual(label.size, ['50% + 10px', 'default']);
  assert.deepEqual(label.offset, ['50%', '100%']);
});

test('dirty size 仅覆盖已编辑字段，未编辑 offset 保留原表达式', () => {
  const rawJson = {
    namespace: 'test',
    sample_menu_root: {
      controls: [
        {
          title: {
            size: ['50%', 'default'],
            offset: ['25%', '10px'],
          },
        },
      ],
    },
  };

  const { parsed, elements } = buildElements(rawJson);
  elements[0] = {
    ...elements[0],
    size: [210, 48],
    dirty: { ...elements[0].dirty, size: true },
  };

  const serializedJson = JSON.parse(serializeUiFile(parsed, elements)) as Record<string, unknown>;
  const control = getFirstControl(serializedJson, 'sample_menu_root');
  const title = control.title as Record<string, unknown>;

  assert.deepEqual(title.size, [210, 48]);
  assert.deepEqual(title.offset, ['25%', '10px']);
});

test('普通继承控件不会被错误写成 chest_grid_item', () => {
  const rawJson = {
    namespace: 'test',
    sample_menu_root: {
      controls: [
        {
          'my_button@common.button': {
            text: 'Play',
          },
        },
      ],
    },
  };

  const { parsed, elements } = buildElements(rawJson);
  const serializedJson = JSON.parse(serializeUiFile(parsed, elements)) as Record<string, unknown>;
  const control = getFirstControl(serializedJson, 'sample_menu_root');
  const button = control['my_button@common.button'] as Record<string, unknown>;

  assert.equal('type' in button, false);
  assert.equal('collection_index' in button, false);
  assert.equal(button.text, 'Play');
});

test('真实 chest_grid_item 保留集合语义且不回写 type', () => {
  const rawJson = {
    namespace: 'test',
    sample_menu_root: {
      controls: [
        {
          'slot_0@chest.chest_grid_item': {
            collection_index: 0,
            collection_name: 'container_items',
            size: [18, 18],
            offset: [0, 0],
          },
        },
      ],
    },
  };

  const { parsed, elements } = buildElements(rawJson);
  const serializedJson = JSON.parse(serializeUiFile(parsed, elements)) as Record<string, unknown>;
  const control = getFirstControl(serializedJson, 'sample_menu_root');
  const slot = control['slot_0@chest.chest_grid_item'] as Record<string, unknown>;

  assert.equal('type' in slot, false);
  assert.equal(slot.collection_index, 0);
  assert.equal(slot.collection_name, 'container_items');
});

test('锚点语义遵循 wiki：anchor_from 取父级锚点，anchor_to 取元素锚点', () => {
  assert.deepEqual(
    applyAnchor('center', 'top_left', 200, 100, 20, 10, [0, 0]),
    [100, 50],
  );
  assert.deepEqual(
    applyAnchor(undefined, undefined, 200, 100, 20, 10, [0, 0]),
    [90, 45],
  );
  assert.deepEqual(
    resolveOffsetFromPosition('center', 'top_left', 200, 100, 20, 10, [100, 50]),
    [0, 0],
  );
});

test('label 解析与序列化保留 Bedrock 文本属性', () => {
  const rawJson = {
    namespace: 'test',
    sample_menu_root: {
      controls: [
        {
          title: {
            type: 'label',
            text: 'Inventory',
            color: [1, 0.8, 0.2],
            text_alignment: 'bottom_right',
            shadow: true,
            font_size: 'large',
            font_scale_factor: 0.65,
            line_padding: 2,
            localize: true,
            font_type: 'MinecraftTen',
            backup_font_type: 'NotoSans',
          },
        },
      ],
    },
  };

  const { parsed, elements } = buildElements(rawJson);

  assert.equal(elements[0].text_alignment, 'bottom_right');
  assert.equal(elements[0].shadow, true);
  assert.equal(elements[0].font_size, 'large');
  assert.equal(elements[0].font_scale_factor, 0.65);
  assert.equal(elements[0].line_padding, 2);
  assert.equal(elements[0].localize, true);
  assert.equal(elements[0].font_type, 'MinecraftTen');
  assert.equal(elements[0].backup_font_type, 'NotoSans');

  const serializedJson = JSON.parse(serializeUiFile(parsed, elements)) as Record<string, unknown>;
  const control = getFirstControl(serializedJson, 'sample_menu_root');
  const label = control.title as Record<string, unknown>;

  assert.equal(label.text_alignment, 'bottom_right');
  assert.equal(label.shadow, true);
  assert.equal(label.font_size, 'large');
  assert.equal(label.font_scale_factor, 0.65);
  assert.equal(label.line_padding, 2);
  assert.equal(label.localize, true);
  assert.equal(label.font_type, 'MinecraftTen');
  assert.equal(label.backup_font_type, 'NotoSans');
});

test('label 渲染计算遵循显式对齐、字号缩放和阴影设置', () => {
  const rendering = resolveLabelRendering({
    text: 'Inventory',
    text_alignment: 'bottom_right',
    font_size: 'large',
    font_scale_factor: 0.65,
    line_padding: 2,
    shadow: true,
    font_type: 'MinecraftTen',
    backup_font_type: 'NotoSans',
  });

  assert.deepEqual(resolveLabelAlignment(undefined, 'center', 'top_left'), {
    horizontal: 'center',
    vertical: 'center',
  });
  const defaultRendering = resolveLabelRendering({
    text: 'Title',
    font_size: 'normal',
  });

  assert.equal(rendering.horizontalAlign, 'end');
  assert.equal(rendering.verticalAlign, 'end');
  assert.equal(rendering.fontSizePx, 10.4);
  assert.equal(rendering.lineHeightPx, 14.48);
  assert.equal(rendering.hasShadow, true);
  assert.equal(rendering.fontFamily, '"Courier New", "Lucida Console", monospace');
  assert.equal(defaultRendering.lineHeightPx, 12);
  assert.ok(defaultRendering.lineHeightPx > defaultRendering.fontSizePx);
});

test('store 支持撤销和重做元素更新', () => {
  const element = createTestElement();
  useStore.setState({
    elements: [element],
    drafts: { 'test.json': [element] },
    selectedId: element.id,
  });

  useStore.getState().updateElement(element.id, { offset: [24, 36] });

  assert.deepEqual(useStore.getState().elements[0]?.offset, [24, 36]);
  assert.equal(useStore.getState().canUndo, true);

  useStore.getState().undo();

  assert.deepEqual(useStore.getState().elements[0]?.offset, [0, 0]);
  assert.equal(useStore.getState().selectedId, element.id);
  assert.equal(useStore.getState().canRedo, true);
  assert.deepEqual(useStore.getState().drafts['test.json']?.[0]?.offset, [0, 0]);

  useStore.getState().redo();

  assert.deepEqual(useStore.getState().elements[0]?.offset, [24, 36]);
  assert.equal(useStore.getState().selectedId, element.id);
});

test('undo 后的新编辑会清空 redo 历史', () => {
  const element = createTestElement();
  useStore.setState({
    elements: [element],
    drafts: { 'test.json': [element] },
    selectedId: element.id,
  });

  useStore.getState().updateElement(element.id, { offset: [10, 12] });
  useStore.getState().updateElement(element.id, { size: [120, 80] });
  useStore.getState().undo();

  assert.equal(useStore.getState().canRedo, true);
  assert.deepEqual(useStore.getState().elements[0]?.size, [100, 100]);
  assert.deepEqual(useStore.getState().elements[0]?.offset, [10, 12]);

  useStore.getState().updateElement(element.id, { name: 'panel_renamed' });

  assert.equal(useStore.getState().canRedo, false);
  assert.deepEqual(useStore.getState().elements[0]?.offset, [10, 12]);
  assert.equal(useStore.getState().elements[0]?.name, 'panel_renamed');
});

test('删除选中元素后可以撤销恢复元素和选中态', () => {
  const element = createTestElement();
  useStore.setState({
    elements: [element],
    drafts: { 'test.json': [element] },
    selectedId: element.id,
  });

  useStore.getState().removeElement(element.id);

  assert.equal(useStore.getState().elements.length, 0);
  assert.equal(useStore.getState().selectedId, null);
  assert.equal(useStore.getState().canUndo, true);

  useStore.getState().undo();

  assert.equal(useStore.getState().elements.length, 1);
  assert.equal(useStore.getState().elements[0]?.id, element.id);
  assert.equal(useStore.getState().selectedId, element.id);

  useStore.getState().redo();

  assert.equal(useStore.getState().elements.length, 0);
  assert.equal(useStore.getState().selectedId, null);
});
