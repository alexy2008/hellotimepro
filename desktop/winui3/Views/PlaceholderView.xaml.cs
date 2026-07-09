using Microsoft.UI.Xaml.Controls;

namespace HelloTimePro.Views;

public sealed partial class PlaceholderView : UserControl
{
    public PlaceholderView(string title)
    {
        InitializeComponent();
        TitleText.Text = title;
    }
}
