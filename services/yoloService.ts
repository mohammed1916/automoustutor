import * as ort from 'onnxruntime-web';

export interface YoloDetection {
  classId: number;
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionCandidate {
  classId: number;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const MODEL_SIZE = 640;
const DEFAULT_MODEL_URL =
  (import.meta as any).env?.VITE_YOLO_MODEL_URL ||
  'https://huggingface.co/onnx-community/yolov8n/resolve/main/onnx/model.onnx';

const COCO_LABELS = [
  'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light',
  'fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow',
  'elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee',
  'skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle',
  'wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange',
  'broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed',
  'dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven',
  'toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'
];

const iou = (a: DetectionCandidate, b: DetectionCandidate): number => {
  const xA = Math.max(a.x1, b.x1);
  const yA = Math.max(a.y1, b.y1);
  const xB = Math.min(a.x2, b.x2);
  const yB = Math.min(a.y2, b.y2);

  const intersection = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  if (intersection <= 0) return 0;

  const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
  const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
};

const nms = (candidates: DetectionCandidate[], threshold = 0.45): DetectionCandidate[] => {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const kept: DetectionCandidate[] = [];

  while (sorted.length > 0) {
    const current = sorted.shift();
    if (!current) break;
    kept.push(current);

    for (let i = sorted.length - 1; i >= 0; i--) {
      const compare = sorted[i];
      if (current.classId === compare.classId && iou(current, compare) > threshold) {
        sorted.splice(i, 1);
      }
    }
  }

  return kept;
};

export class YoloDetector {
  private session: ort.InferenceSession | null = null;
  private readonly inputName = 'images';
  private readonly modelUrl: string;
  private readonly modelCanvas: HTMLCanvasElement;
  private readonly modelCtx: CanvasRenderingContext2D;

  constructor(modelUrl: string = DEFAULT_MODEL_URL) {
    this.modelUrl = modelUrl;
    this.modelCanvas = document.createElement('canvas');
    this.modelCanvas.width = MODEL_SIZE;
    this.modelCanvas.height = MODEL_SIZE;

    const ctx = this.modelCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Could not create YOLO preprocessing canvas context.');
    }

    this.modelCtx = ctx;
  }

  async init() {
    if (this.session) return;

    this.session = await ort.InferenceSession.create(this.modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
  }

  isReady() {
    return !!this.session;
  }

  async detect(
    source: HTMLVideoElement,
    confidenceThreshold = 0.35,
    maxDetections = 8
  ): Promise<YoloDetection[]> {
    if (!this.session) return [];

    const sourceWidth = source.videoWidth;
    const sourceHeight = source.videoHeight;
    if (!sourceWidth || !sourceHeight) return [];

    this.modelCtx.clearRect(0, 0, MODEL_SIZE, MODEL_SIZE);
    this.modelCtx.drawImage(source, 0, 0, MODEL_SIZE, MODEL_SIZE);

    const image = this.modelCtx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
    const input = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);

    for (let p = 0; p < MODEL_SIZE * MODEL_SIZE; p++) {
      const pixelIndex = p * 4;
      input[p] = image.data[pixelIndex] / 255; // R
      input[MODEL_SIZE * MODEL_SIZE + p] = image.data[pixelIndex + 1] / 255; // G
      input[2 * MODEL_SIZE * MODEL_SIZE + p] = image.data[pixelIndex + 2] / 255; // B
    }

    const tensor = new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
    const result = await this.session.run({ [this.inputName]: tensor });

    const outputName = Object.keys(result)[0];
    const output = result[outputName];
    if (!output?.data) return [];

    const data = output.data as Float32Array;
    const dims = output.dims;

    // Most YOLOv8 exports are [1, 84, 8400], but some are [1, 8400, 84].
    const channelsFirst = dims[1] < dims[2];
    const rows = channelsFirst ? dims[2] : dims[1];
    const cols = channelsFirst ? dims[1] : dims[2];

    const candidates: DetectionCandidate[] = [];

    for (let row = 0; row < rows; row++) {
      const cx = channelsFirst ? data[row] : data[row * cols];
      const cy = channelsFirst ? data[rows + row] : data[row * cols + 1];
      const w = channelsFirst ? data[2 * rows + row] : data[row * cols + 2];
      const h = channelsFirst ? data[3 * rows + row] : data[row * cols + 3];

      let bestClass = -1;
      let bestScore = 0;

      for (let c = 4; c < cols; c++) {
        const score = channelsFirst ? data[c * rows + row] : data[row * cols + c];
        if (score > bestScore) {
          bestScore = score;
          bestClass = c - 4;
        }
      }

      if (bestClass < 0 || bestScore < confidenceThreshold) continue;

      const x1 = (cx - w / 2) / MODEL_SIZE;
      const y1 = (cy - h / 2) / MODEL_SIZE;
      const x2 = (cx + w / 2) / MODEL_SIZE;
      const y2 = (cy + h / 2) / MODEL_SIZE;

      candidates.push({
        classId: bestClass,
        confidence: bestScore,
        x1,
        y1,
        x2,
        y2
      });
    }

    const kept = nms(candidates)
      .slice(0, maxDetections)
      .map((candidate) => {
        const x = Math.max(0, candidate.x1) * sourceWidth;
        const y = Math.max(0, candidate.y1) * sourceHeight;
        const width = Math.max(0, Math.min(1, candidate.x2) - Math.max(0, candidate.x1)) * sourceWidth;
        const height = Math.max(0, Math.min(1, candidate.y2) - Math.max(0, candidate.y1)) * sourceHeight;

        return {
          classId: candidate.classId,
          confidence: candidate.confidence,
          label: COCO_LABELS[candidate.classId] || `class_${candidate.classId}`,
          x,
          y,
          width,
          height
        };
      });

    return kept;
  }
}
