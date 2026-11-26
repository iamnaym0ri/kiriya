import SwiftUI
import WidgetKit

// The lab's widget extension: only the little note, exactly as ios/App/KiriyaWidgets/Notes builds it.
@main
struct NotesWidgetLabBundle: WidgetBundle {
    var body: some Widget {
        NotesWidget()
    }
}
