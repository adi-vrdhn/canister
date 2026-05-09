@echo off
setlocal

set APP_DIR=%~dp0
set DEFAULT_JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set DEFAULT_GRADLE_USER_HOME=%TEMP%\cineparte-android-gradle

if not defined JAVA_HOME (
  if exist "%DEFAULT_JAVA_HOME%\bin\java.exe" set JAVA_HOME=%DEFAULT_JAVA_HOME%
)

if not defined GRADLE_USER_HOME set GRADLE_USER_HOME=%DEFAULT_GRADLE_USER_HOME%

if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"

if defined JAVA_HOME (
  set JAVA_CMD=%JAVA_HOME%\bin\java.exe
) else (
  set JAVA_CMD=java.exe
)

set CLASSPATH=%APP_DIR%gradle\wrapper\gradle-wrapper.jar

"%JAVA_CMD%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
