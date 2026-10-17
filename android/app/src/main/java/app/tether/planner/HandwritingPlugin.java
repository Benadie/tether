package app.tether.planner;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.recognition.Ink;
import com.google.mlkit.vision.digitalink.common.RecognitionCandidate;
import com.google.mlkit.vision.digitalink.recognition.RecognitionContext;
import com.google.mlkit.vision.digitalink.recognition.WritingArea;
import org.json.JSONArray;

/**
 * On-device handwriting recognition with Google ML Kit Digital Ink.
 * The English model (~20 MB) downloads once, then everything runs offline;
 * no handwriting ever leaves the tablet.
 */
@CapacitorPlugin(name = "Handwriting")
public class HandwritingPlugin extends Plugin {

    private DigitalInkRecognitionModel model;
    private DigitalInkRecognizer recognizer;

    @PluginMethod
    public void prepare(PluginCall call) {
        try {
            if (model == null) {
                DigitalInkRecognitionModelIdentifier id = DigitalInkRecognitionModelIdentifier.fromLanguageTag("en-US");
                model = DigitalInkRecognitionModel.builder(id).build();
            }
            RemoteModelManager manager = RemoteModelManager.getInstance();
            manager
                .isModelDownloaded(model)
                .addOnSuccessListener(downloaded -> {
                    if (downloaded) {
                        ready(call);
                        return;
                    }
                    manager
                        .download(model, new DownloadConditions.Builder().build())
                        .addOnSuccessListener(v -> ready(call))
                        .addOnFailureListener(e -> call.reject("Could not download the handwriting model: " + e.getMessage()));
                })
                .addOnFailureListener(e -> call.reject("Could not check the handwriting model: " + e.getMessage()));
        } catch (Exception e) {
            call.reject("Handwriting recognition is not available: " + e.getMessage());
        }
    }

    private void ready(PluginCall call) {
        if (recognizer == null) {
            recognizer = DigitalInkRecognition.getClient(DigitalInkRecognizerOptions.builder(model).build());
        }
        JSObject ret = new JSObject();
        ret.put("ready", true);
        call.resolve(ret);
    }

    /** strokes: [[x, y, x, y, ...], ...] in the line's coordinates; width/height: the line's size. */
    @PluginMethod
    public void recognize(PluginCall call) {
        if (recognizer == null) {
            call.reject("Handwriting model is not ready yet");
            return;
        }
        try {
            JSArray strokes = call.getArray("strokes");
            Ink.Builder ink = Ink.builder();
            for (int i = 0; i < strokes.length(); i++) {
                JSONArray pts = strokes.getJSONArray(i);
                Ink.Stroke.Builder stroke = Ink.Stroke.builder();
                for (int j = 0; j + 1 < pts.length(); j += 2) {
                    stroke.addPoint(Ink.Point.create((float) pts.getDouble(j), (float) pts.getDouble(j + 1)));
                }
                ink.addStroke(stroke.build());
            }
            float width = call.getFloat("width", 0f);
            float height = call.getFloat("height", 0f);
            RecognitionContext.Builder context = RecognitionContext.builder().setPreContext("");
            if (width > 0 && height > 0) context.setWritingArea(new WritingArea(width, height));

            recognizer
                .recognize(ink.build(), context.build())
                .addOnSuccessListener(result -> {
                    JSArray candidates = new JSArray();
                    for (RecognitionCandidate c : result.getCandidates()) candidates.put(c.getText());
                    JSObject ret = new JSObject();
                    ret.put("text", result.getCandidates().isEmpty() ? "" : result.getCandidates().get(0).getText());
                    ret.put("candidates", candidates);
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> call.reject("Recognition failed: " + e.getMessage()));
        } catch (Exception e) {
            call.reject("Recognition failed: " + e.getMessage());
        }
    }
}
