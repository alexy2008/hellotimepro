# SQLite 的内置 LOWER 只处理 ASCII。昵称和胶囊标题允许 Unicode。
ActiveSupport.on_load(:active_record_sqlite3adapter) do
  prepend(Module.new do
    private

    def configure_connection
      super
      @raw_connection.create_function("hellotime_lower", 1) do |function, value|
        function.result = value&.downcase
      end
    end
  end)
end
