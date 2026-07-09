using Microsoft.UI.Xaml.Controls;

namespace HelloTimePro.Views;

public sealed partial class AppFooter : UserControl
{
    public AppFooter()
    {
        InitializeComponent();
        ApiText.Text = $"WinUI 3 · {App.Store.ApiBaseDescription}";
    }
}
